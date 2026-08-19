use std::sync::Mutex;

use tauri::Manager;

use super::media_download::MAX_DOWNLOAD_BYTES;

/// App-lifetime clipboard ownership keeps copied data available on Linux and
/// serializes access on Windows. All operations still run on Tauri's main
/// thread for macOS/AppKit safety.
pub struct ClipboardState(Mutex<Option<arboard::Clipboard>>);

impl ClipboardState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }

    pub fn release(&self) {
        if let Ok(mut clipboard) = self.0.lock() {
            clipboard.take();
        }
    }
}

pub fn with_clipboard<T>(
    app: &tauri::AppHandle,
    operation: impl FnOnce(&mut arboard::Clipboard) -> Result<T, arboard::Error>,
) -> Result<T, String> {
    let state = app.state::<ClipboardState>();
    let mut stored = state
        .0
        .lock()
        .map_err(|_| "clipboard state lock poisoned".to_string())?;
    if stored.is_none() {
        *stored = Some(arboard::Clipboard::new().map_err(|e| format!("clipboard error: {e}"))?);
    }
    operation(stored.as_mut().expect("clipboard initialized"))
        .map_err(|e| format!("clipboard error: {e}"))
}

struct OwnedClipboardImage {
    bytes: Vec<u8>,
    height: usize,
    width: usize,
}

fn own_clipboard_image(image: arboard::ImageData<'_>) -> Result<OwnedClipboardImage, String> {
    let expected_len = image
        .width
        .checked_mul(image.height)
        .and_then(|pixels| pixels.checked_mul(4))
        .ok_or_else(|| "clipboard image dimensions are too large".to_string())?;
    if expected_len as u64 > MAX_DOWNLOAD_BYTES {
        return Err("clipboard image exceeds the 50 MiB decoded limit".to_string());
    }
    if image.bytes.len() != expected_len {
        return Err("clipboard image RGBA byte length is invalid".to_string());
    }
    Ok(OwnedClipboardImage {
        bytes: image.bytes.into_owned(),
        height: image.height,
        width: image.width,
    })
}

const CLIPBOARD_IMAGE_UNAVAILABLE: &str = "clipboard image unavailable";

fn read_owned_clipboard_image(app: &tauri::AppHandle) -> Result<OwnedClipboardImage, String> {
    let state = app.state::<ClipboardState>();
    let mut stored = state
        .0
        .lock()
        .map_err(|_| "clipboard state lock poisoned".to_string())?;
    if stored.is_none() {
        *stored = Some(arboard::Clipboard::new().map_err(|e| format!("clipboard error: {e}"))?);
    }
    match stored.as_mut().expect("clipboard initialized").get_image() {
        Ok(image) => own_clipboard_image(image),
        Err(arboard::Error::ContentNotAvailable) => Err(CLIPBOARD_IMAGE_UNAVAILABLE.to_string()),
        Err(error) => Err(format!("clipboard error: {error}")),
    }
}

/// Encode validated native RGBA clipboard pixels as PNG off the main thread.
fn clipboard_image_png(image: OwnedClipboardImage) -> Result<Vec<u8>, String> {
    let width =
        u32::try_from(image.width).map_err(|_| "clipboard image width is too large".to_string())?;
    let height = u32::try_from(image.height)
        .map_err(|_| "clipboard image height is too large".to_string())?;
    let rgba = image::RgbaImage::from_raw(width, height, image.bytes)
        .ok_or_else(|| "clipboard image RGBA byte length is invalid".to_string())?;
    let mut png = Vec::new();
    image::DynamicImage::ImageRgba8(rgba)
        .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
        .map_err(|e| format!("clipboard image PNG encoding failed: {e}"))?;
    if png.len() as u64 > MAX_DOWNLOAD_BYTES {
        return Err("clipboard PNG exceeds the 50 MiB encoded limit".to_string());
    }
    Ok(png)
}

/// Read plain text from the system clipboard through the native shell.
///
/// Browser clipboard reads are permission-gated or unavailable in embedded
/// webviews. Arboard provides one consistent path across WKWebView, WebView2,
/// and WebKitGTK. The operation runs on the main thread for macOS/AppKit safety.
#[tauri::command]
pub async fn read_clipboard_text(app: tauri::AppHandle) -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::sync_channel::<Result<String, String>>(1);
    let clipboard_app = app.clone();
    app.run_on_main_thread(move || {
        let result = with_clipboard(&clipboard_app, arboard::Clipboard::get_text);
        let _ = tx.send(result);
    })
    .map_err(|e| format!("main thread dispatch failed: {e}"))?;

    rx.recv()
        .map_err(|_| "clipboard result channel closed unexpectedly".to_string())?
}

/// Read an image through the native clipboard when the webview exposes only its MIME type.
/// Returns raw PNG bytes so large screenshots do not expand into JSON number arrays.
#[tauri::command]
pub async fn read_clipboard_image(app: tauri::AppHandle) -> Result<tauri::ipc::Response, String> {
    let (tx, rx) = std::sync::mpsc::sync_channel::<Result<OwnedClipboardImage, String>>(1);
    let clipboard_app = app.clone();
    app.run_on_main_thread(move || {
        let result = read_owned_clipboard_image(&clipboard_app);
        let _ = tx.send(result);
    })
    .map_err(|e| format!("main thread dispatch failed: {e}"))?;

    let image = rx
        .recv()
        .map_err(|_| "clipboard result channel closed unexpectedly".to_string())??;
    let png = tauri::async_runtime::spawn_blocking(move || clipboard_image_png(image))
        .await
        .map_err(|e| format!("clipboard image encoder task failed: {e}"))??;
    Ok(tauri::ipc::Response::new(png))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::borrow::Cow;

    #[test]
    fn clipboard_image_png_encodes_valid_png_bytes() {
        let image = own_clipboard_image(arboard::ImageData {
            bytes: Cow::Borrowed(&[1, 2, 3, 4]),
            height: 1,
            width: 1,
        })
        .unwrap();
        let png = clipboard_image_png(image).unwrap();

        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
        let decoded = image::load_from_memory(&png).unwrap();
        assert_eq!(decoded.width(), 1);
        assert_eq!(decoded.height(), 1);
    }

    #[test]
    fn clipboard_image_png_rejects_invalid_rgba_length() {
        let error = own_clipboard_image(arboard::ImageData {
            bytes: Cow::Borrowed(&[1, 2, 3]),
            height: 1,
            width: 1,
        })
        .err()
        .unwrap();

        assert!(error.contains("RGBA byte length"));
    }

    #[test]
    fn clipboard_image_rejects_decoded_data_over_shared_media_limit() {
        let error = own_clipboard_image(arboard::ImageData {
            bytes: Cow::Borrowed(&[]),
            height: 1,
            width: (MAX_DOWNLOAD_BYTES as usize / 4) + 1,
        })
        .err()
        .unwrap();

        assert!(error.contains("50 MiB decoded limit"));
    }
}
