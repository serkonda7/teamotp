declare module '*.css'
declare module '*.svg' {
	const src: string
	export default src
}

declare const __APP_VERSION__: string

// Not part of TypeScript's DOM lib yet
declare class BarcodeDetector {
	constructor(options?: { formats: string[] })
	static getSupportedFormats(): Promise<string[]>
	detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>
}
