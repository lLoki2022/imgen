import { GlobalFonts, Path2D, createCanvas, loadImage } from '@napi-rs/canvas';
import { json, type RequestHandler } from '@sveltejs/kit';
import { generateImage } from '../../lib/generate.js';
import parseConfig from '../../lib/parseConfig.js';
import { decodeGifUrl, encodeAnimatedGif, ctxToRgba } from '../../lib/gif.js';
// @ts-ignore
import url from "node:url";
// @ts-ignore
import { join } from "node:path";

const fonts = import.meta.glob("/static/fonts/**/*.ttf", { as: "url", eager: true })
function makeError(error: string) { return json({ error }, { status: 400 }) }
let once = false;
if (!once) {
    Object.values(fonts).map(file => GlobalFonts.registerFromPath(join(process.cwd(), file)))
    once = true;
}

export const GET: RequestHandler = async (e) => {
    if (e.url.searchParams.get("fonts") !== null) return json(fonts)
    // @ts-ignore
    globalThis.Path2D = Path2D;
    // @ts-ignore
    globalThis.loadImage = loadImage;
    const config = parseConfig(e.url.search)
    if (config.width > 2000 || config.height > 2000) return makeError("max canvas size 2000x2000")
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');

    if (config.fmt === 'gif') {
        let maxFrames = 1;
        let nativeDelayMs: number | null = null;
        for (const layer of config.layers) {
            if (layer.type !== 'img') continue;
            const src = typeof layer.data === 'string' ? decodeURIComponent(layer.data) : '';
            if (!src) continue;
            const decoded = await decodeGifUrl(src);
            if (decoded && decoded.frames.length > 1) {
                // @ts-ignore
                layer.data = { $name: src, $elem: decoded.frames[0].canvas,
                    $frames: decoded.frames, $gifDelay: decoded.frames[0].delay };
                maxFrames = Math.max(maxFrames, decoded.frames.length);
                const dms = (decoded.frames[0].delay || 10) * 10;
                nativeDelayMs = nativeDelayMs == null ? dms : Math.min(nativeDelayMs, dms);
            } else {
                // @ts-ignore
                layer.data = { $name: src, $elem: await loadImage(src) };
            }
        }
        const requestedFrames = config.frames || maxFrames;
        const totalFrames = Math.max(1, Math.min(requestedFrames, 120));
        const userFps = config.fps;
        const delayMs = userFps && userFps > 0 ? 1000 / userFps : nativeDelayMs ?? 100;
        const frameBuffers: Uint8Array[] = [];
        for (let i = 0; i < totalFrames; i++) {
            await generateImage(ctx, config, i);
            const rgba = ctxToRgba(ctx, config.width, config.height);
            frameBuffers.push(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength));
        }
        const gifBytes = encodeAnimatedGif(frameBuffers, config.width, config.height, delayMs);
        return new Response(gifBytes, {
            headers: { 'Content-Type': 'image/gif',
                'Content-Disposition': 'inline; filename="imgenx.gif"',
                'Cache-Control': 'public, max-age=60' }
        });
    }

    await generateImage(ctx, config);
    return new Response(canvas.toBuffer('image/webp'), { headers: { 'Content-Type': 'image/webp' } });
};
