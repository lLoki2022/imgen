import { GifReader } from 'omggif';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc as any;
import { createCanvas, ImageData as NapiImageData } from '@napi-rs/canvas';
import type { SKRSContext2D, Canvas as NapiCanvas } from '@napi-rs/canvas';

export type GifFrame = {
	pixels: Uint8Array;
	width: number;
	height: number;
	delay: number;
	canvas: NapiCanvas;
};

export type DecodedGif = { width: number; height: number; frames: GifFrame[]; };

export async function decodeGifUrl(url: string): Promise<DecodedGif | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const ct = res.headers.get('content-type') || '';
		const buf = new Uint8Array(await res.arrayBuffer());
		const isGif = ct.includes('image/gif') ||
			(buf.length > 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38);
		if (!isGif) return null;

		const reader = new GifReader(buf);
		const width = reader.width, height = reader.height;
		const n = reader.numFrames();
		const composite = new Uint8Array(width * height * 4);
		const frames: GifFrame[] = [];

		for (let i = 0; i < n; i++) {
			const info = reader.frameInfo(i);
			reader.decodeAndBlitFrameRGBA(i, composite);
			const pixels = new Uint8Array(composite);
			const c = createCanvas(width, height);
			const cctx = c.getContext('2d');
			const imageData = new NapiImageData(
				new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength),
				width, height
			);
			cctx.putImageData(imageData, 0, 0);
			frames.push({ pixels, width, height, delay: info.delay || 10, canvas: c });
		}
		return { width, height, frames };
	} catch (e) {
		console.warn('decodeGifUrl failed:', (e as Error).message);
		return null;
	}
}

export function encodeAnimatedGif(
	frames: Uint8Array[] | Uint8ClampedArray[],
	width: number, height: number, delayMs: number
): Uint8Array {
	const gif = GIFEncoder();
	for (const rgba of frames) {
		const flat = rgba instanceof Uint8Array
			? rgba
			: new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
		const palette = quantize(flat, 256, { format: 'rgba4444' });
		const index = applyPalette(flat, palette, 'rgba4444');
		gif.writeFrame(index, width, height, {
			palette, delay: Math.max(2, Math.round(delayMs)), transparent: true
		});
	}
	gif.finish();
	return gif.bytes();
}

export function ctxToRgba(ctx: SKRSContext2D, width: number, height: number): Uint8ClampedArray {
	return ctx.getImageData(0, 0, width, height).data as Uint8ClampedArray;
}
