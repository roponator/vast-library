interface FetchUrlOptions {
  url: string;
  loadCallback: (response: string) => void;
  syncInBrowser: boolean;
  retries: number;
  headers?: Record<string, string>;
}

interface FetchUrlSyncOptions {
  url: string;
  retries?: number;
  headers?: Record<string, string>;
}

interface FetchUrlAsyncOptions {
  url: string;
  onError: (response: string) => void;
  onSuccess: (response: string) => void;
  retries?: number;
  headers?: Record<string, string>;
}

function fetchUrlSync({ url, retries = 2 }: FetchUrlSyncOptions) {
  let attempts = 0;
  const errors = [];

  while (attempts++ < retries) {
    let request;
    try {
      request = new XMLHttpRequest();
      request.open("GET", url, false);
      request.send();

      if (request.status >= 200 && request.status < 400) {
        return request.responseText;
      }
    } catch (e) {
      errors.push(`REQ #${attempts} message : ${e.message}`);

      if (e.name) {
        errors.push(`REQ #${attempts} name : ${e.name}`);
      }

      if (e.code) {
        errors.push(`REQ #${attempts} code : ${e.code}`);
      }
    }

    if (request && request.status) {
      errors.push(`REQ #${attempts} status : ${request.status}`);
    }
  }

  throw new Error(`${url} fetch failed after ${attempts} attempts. ${errors.join(', ')}`);
}

function fetchUrlAsync({ url, onError, onSuccess, retries = 2, headers }: FetchUrlAsyncOptions) {
  if (retries === 0) {
    onError(`${url} fetch failed after 3 attempts`);
    return;
  }

  const request = new XMLHttpRequest();

  for (const [key, value] of Object.entries(headers || {})) {
    request.setRequestHeader(key, value);
  }

  request.open("GET", url, true);
  request.onerror = () => {
    fetchUrlAsync({
      onError,
      onSuccess,
      retries: retries - 1,
      url
    });
  };
  request.onload = res => {
    onSuccess((res as any).responseText);
  };
  request.send();
}

export function fetchUrl({
  url,
  loadCallback = () => {},
  syncInBrowser = false
}: FetchUrlOptions) {
  if (!url) {
    throw new Error("'url' is undefined");
  }
  if (syncInBrowser) {
    return fetchUrlSync({ url });
  } else {
    fetchUrlAsync({
      onError: () => {
        throw new Error(`${url} fetch failed`);
      },
      onSuccess: loadCallback,
      url
    });
  }
}
