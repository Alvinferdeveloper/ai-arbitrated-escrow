export type UploadResult = { ok: boolean; message?: string };

// XHR rather than fetch: fetch cannot report upload progress.
export function uploadWithProgress(
  url: string,
  body: FormData,
  onProgress: (fraction: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      try {
        resolve(JSON.parse(request.responseText) as UploadResult);
      } catch {
        resolve({ ok: false, message: "The server answered with an error. Try again." });
      }
    };
    request.onerror = () =>
      resolve({
        ok: false,
        message: "The upload was interrupted. Check the connection and try again.",
      });
    request.send(body);
  });
}
