import axios from "axios";
export const api = axios.create({
    baseURL: "",
    headers: { "Content-Type": "application/json" },
});

// For proxied dev calls, pass paths starting with "/" (e.g., "/map-batch")
export function toPath(pathOrAbsolute: string) {
    return pathOrAbsolute.startsWith("/") ? pathOrAbsolute : `/${pathOrAbsolute}`;
}
