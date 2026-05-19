import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import { GET as imgGet } from '../img/+server';

export const GET: RequestHandler = async (event: RequestEvent) => {
	const url = new URL(event.url);
	url.searchParams.set('fmt', 'gif');
	const patched: RequestEvent = { ...event, url };
	// @ts-ignore
	return imgGet(patched);
};
