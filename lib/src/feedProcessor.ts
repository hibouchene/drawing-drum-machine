import Channels from "./channels";

const worker = new Worker(
  new URL('./workers/imageProcessing.js', import.meta.url),
  { type: 'module' }
);

/**
 * The video feed processor Class
 * @constructor
 * @param HTMLVideoElement The video HTML Element to process
 */
class FeedProcessor{
    static instance: FeedProcessor | undefined = undefined
    /**
     * Canvas that will get the video feed pixel's data, no need to make it visible to the DOM so it's offscreen
     */
    frame: OffscreenCanvas

    ctx: OffscreenCanvasRenderingContext2D | null

    /**
     * The video DOM element
     */
    video: HTMLVideoElement
    constructor(video: HTMLVideoElement){
        
        //We use the parent clientWidth so you can wrap the video into an overflow hidden element
        if(!video.parentElement) throw new Error("Video has no parent element");

        if(video.parentElement.clientWidth == 0 || video.parentElement.clientHeight == 0) throw new Error("Parent element has zero width or height");

        this.frame = new OffscreenCanvas(video.parentElement.clientWidth, video.parentElement.clientHeight);


        const ctx = this.frame.getContext("2d", {
            willReadFrequently: true
        })

        this.ctx = ctx;

        this.video = video;

        //Handling resize events
        window.addEventListener("resize", (e) => {

            if(this.video.clientWidth !== this.frame.width){

                if(!video.parentElement) throw new Error("Video has no parent element");

                this.frame.width = video.parentElement.clientWidth;
                this.frame.height = video.parentElement.clientHeight;

            }

        })

        FeedProcessor.instance = this;

    }

    /**
     * Captures the video frame to the canvas and get its pixels
     * @returns Promise of an Array of 16 ImageDataArray
     */

    async capture(){

        return new Promise<Array<ImageDataArray>>((resolve, reject) => {

            let data: Array<ImageDataArray> = [];

            if(this.ctx){
                
                const cw = this.frame.width, ch = this.frame.height;

                const stepSizeX = cw / 4, stepSizeY = ch / 4;

                this.draw();

                for(let c = 0; c < 4; c++){

                    for(let r = 0; r < 4; r++){

                        const x = r * stepSizeX;
                        const y = c * stepSizeY;

                        const areaData = this.ctx.getImageData(x, y, stepSizeX, stepSizeY);

                        data.push(areaData.data);

                    }

                }

                resolve(data);

            } else {

                reject("Canvas ctx is null");

            }
        })

    }

    /**
     * Rescale the video to make it fit into the canvas. Useful for cases when the video is cropped by parent overflow.
     * @returns The rescale width and height of video
     */
    videoToFrameScale(){

        const ratioX = this.video.videoWidth / this.video.clientWidth;
        
        const ratioY = this.video.videoHeight / this.video.clientHeight;
        
        const sWidth = this.frame.width * ratioX;
        
        const sHeight = this.frame.height * ratioY;

        return {
            scaledWidth : sWidth,
            scaledHeight: sHeight
        }

    }

    /**
     * Compute the scaled width of the video (see videoToFrameScale method) and draw its pixels to the canvas
     */
    draw(){

        const { scaledWidth, scaledHeight } = this.videoToFrameScale();

        this.ctx?.drawImage(this.video, 0, 0, scaledWidth, scaledHeight, 0, 0, this.frame.width, this.frame.height);

    }

    /**
     * @param data The ImageDataArray containing the image's pixels data
     * @param channels A Channels instance containing the color channels to process
     * @returns The Strudel sequence
     */

    async process(data: Array<ImageDataArray>, channels: Channels){

        return new Promise<Array<string>>((resolve, reject) => {

            if(window.Worker){
                
                worker.postMessage({

                    data: data,
                    channels: channels.elements

                });

                worker.onmessage = (m) => {

                    resolve(m.data);

                }
            
            } else {
                
                reject("Web workers are not compatible with this navigator");

            }

        });

    }

    /**
     * Gets a Strudel sequence from Channels array
     * @param channels
     * @returns 
     */

    seq(channels : Channels){

        const res = this.capture().then((data: Array<ImageDataArray>) => this.process(data, channels));

        return res;

    }

    get pixel(){

        return new Promise<ImageDataArray | number>((resolve, reject) => {

            const handler = (e: MouseEvent) => {

                if(e.target == this.video){

                    if(this.ctx){

                        const rect = this.video.getBoundingClientRect();

                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;

                        this.draw();

                        const data = this.ctx.getImageData(x,y,1,1);

                        resolve(data.data);

                    } else {

                        reject("Frame context is null");

                    }

                    
                } else {

                    resolve(-1);

                }
            
                window.removeEventListener("mousedown", handler);

            }

            window.addEventListener("mousedown", handler);
                
            })
        
    }
}

export default FeedProcessor;