import { GifReader } from 'omggif';

export type ClientImageData = {
	$name: string;
	$elem: HTMLImageElement | HTMLCanvasElement;
	$frames?: Array<{ canvas: HTMLCanvasElement; delay: number }>;
	$gifDelay?: number;
};

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = () => {
			const img2 = new Image();
			img2.onload = () => resolve(img2);
			img2.onerror = () => resolve(img);
			img2.src = url;
		};
		img.src = url;
	});
}

export async function loadGifAware(url: string): Promise<ClientImageData> {
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error('fetch failed');
		const ct = res.headers.get('content-type') || '';
		const buf = new Uint8Array(await res.arrayBuffer());
		const isGif = ct.includes('image/gif') ||
			(buf.length > 6 && buf[0]===0x47 && buf[1]===0x49 && buf[2]===0x46 && buf[3]===0x38);

		if (!isGif) {
			const blob = new Blob([buf], { type: ct || 'image/png' });
			const objUrl = URL.createObjectURL(blob);
			const img = await loadHtmlImage(objUrl);
			return { $name: url, $elem: img };
		}

		const reader = new GifReader(buf);
		const width = reader.width, height = reader.height;
		const n = reader.numFrames();
		const composite = new Uint8Array(width * height * 4);
		const frames: ClientImageData['$frames'] = [];

		for (let i = 0; i < n; i++) {
			const info = reader.frameInfo(i);
			reader.decodeAndBlitFrameRGBA(i, composite);
			const c = document.createElement('canvas');
			c.width = width; c.height = height;
			const cctx = c.getContext('2d')!;
			const id = cctx.createImageData(width, height);
			id.data.set(composite);
			cctx.putImageData(id, 0, 0);
			frames.push({ canvas: c, delay: info.delay || 10 });
		}
		return { $name: url, $elem: frames[0].canvas, $frames: frames, $gifDelay: frames[0].delay || 10 };
	} catch {
		const img = await loadHtmlImage(url);
		return { $name: url, $elem: img };
	}
}
