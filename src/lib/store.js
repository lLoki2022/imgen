import { writable } from "svelte/store";
import type { LayerImg, LayerShp, LayerTxt } from "./types";
export let config = writable<{ width:number, height:number, fill:string,
    layers:(LayerImg|LayerShp|LayerTxt)[], fmt?:"webp"|"gif", frames?:number, fps?:number }>({
    width: 400, height: 400, fill: '#888888', fmt: 'webp', frames: 0, fps: 10, layers: [],
})
export let current = writable<null|number>(null)
