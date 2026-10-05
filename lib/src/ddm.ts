/**
 * Base class for drawing drum machine
 */

import { initStrudel, samples, getAudioContext, evaluate } from '@strudel/web';


import Channels from "./channels";
import FeedProcessor from "./feedProcessor";

interface AutoOptions{
    enabled?: boolean,
    refresh_rate?: number
}

class DDM extends HTMLElement{
    cpm: number = 120;
    audioContext: AudioContext | undefined
    scheduler: any | undefined
    _steps: number = 0
    auto: AutoOptions = {
        enabled: false,
        refresh_rate: 16
    }
    channels: Channels | undefined
    processor: FeedProcessor | undefined

    constructor(){

        super();

    }

    /** Gets the current step */
    get step(){
        
        if(!this.scheduler) throw new Error("Strudel scheduler is not defined");

        const now = this.scheduler.getTime();

        const secondsAtChange = this.scheduler.seconds_at_cps_change;
        const cyclesAtChange = this.scheduler.num_cycles_at_cps_change;
        const currentCPS = this.scheduler.cps;

        const absoluteCycle = cyclesAtChange + (now - secondsAtChange) * currentCPS;

        const currentStep = Math.floor((absoluteCycle % 1) * 16);

        return currentStep;

    }

    /** Gets all steps since start */
    get steps(){

        return this._steps;

    }

    set tempo(value: number){

        this.cpm = value;

    }

    set autorate(value: number){

        this.auto.refresh_rate = value;

    }

    connectedCallback(){
        

        const step = document.createElement("div");
        step.className = "step";

        const samplesAttribute = this.getSamples();

        //let processor: FeedProcessor;

        /**
         * Init strudel with specified samples then launch the animation loop of step (see start method)
         */
        initStrudel({
            prebake: () => {
                
                if(samplesAttribute){

                    const sampleArray = samplesAttribute.replace(" ", "").split(";");

                    sampleArray.forEach((s) => samples(s));

                }

            },
        }).then((strudel) => this.start(strudel, step));

        const auto_rate = this.getAttribute("autorate");

        if(auto_rate) this.auto.refresh_rate = Number(auto_rate);

        //Checks if all required web components are in place in the DOM
        const channels = Channels.instance;

        if(!channels) throw new Error("There is no channels");

        this.channels = channels;

        /**
         * The video element that will show the video feed
         */
        this.initVideo().then((video) => {

            this.append(video, step);

            this.audioContext = getAudioContext();

            this.processor = new FeedProcessor(video);

             //User CTRL+S event for getting image data and evaluate sound from its computed sequence
            window.addEventListener("keydown", (e) => {

                    //To avoid the default keyboard events
                   
                    if(e.key === "s" && e.ctrlKey){

                         e.preventDefault();
                        //Interrupts auto refresh
                        if(this.auto.enabled) this.auto.enabled = false;

                        this.update();
                        

                    }

                    if(e.key === "d" && e.ctrlKey){

                         e.preventDefault();

                        if(!this.auto.enabled) this.auto.enabled = true;

                    }

            })

        })
    }

    //TODO write exceptions
    /**
     * Ask user for video then use the stream to create a video object
     * @returns A HTMLVideoObject containing the feed
     */
    async initVideo(){

        return new Promise<HTMLVideoElement>((resolve, reject) => {

            navigator.mediaDevices.getUserMedia({

            //Video is in facing mode environment for mobile devices
            //TODO fix firefox mobile orientation (being vertically rotated by default)
            video: {

                facingMode: "environment"

            }

            }).then(stream => {

                const video = document.createElement("video");
                video.srcObject = stream;
                video.play();

                resolve(video);
                
            })

        });
    }

    /**
    * Parses the samples defined in samples attribute
    */
    getSamples(){

        const samplesAttribute = this.getAttribute("samples");

        return samplesAttribute

    }

    update(){

            if(!this.processor) throw new Error("Update failed: FeedProcessor is not defined");
            if(!this.channels) throw new Error("Update failed : Channels are not defined");

            //Gets the sequence (async) and uses it for strudel evaluation (see refresh method)
            this.processor.seq(this.channels).then((seq) => {
            
                if(this.channels){

                    const struct = this.codesToStruct(seq, this.channels.values)

                    this.refresh(struct);

                }

        });

    }

    /**
     * 
     * @param seq The sequence as an Array of formated strings for strudel pattern
     * @param codes The codes from editors
     */
    refresh(struct: Array<string>){

        if(!this.audioContext) throw new Error("AudioContext is not defined");
                
        if (this.audioContext.state === 'suspended') {

            this.audioContext.resume();

        }
        
        const stack = 
        `stack(
                    setcpm(${this.cpm/4}),
                    ${struct.join(",")}
        )
        `
        evaluate(stack);

    }

    /**Refreshes each n steps */
    autorefresh(){

        if(this.auto.refresh_rate && this.steps % this.auto.refresh_rate == 0){
            this.update();
        }

    }

    codesToStruct(seq: Array<string>, codes: Array<string>){

        const struct = codes.map((el, index) => {
            
            if(el === ""){

                return `n("${seq[index]}").hush()`

            } else {

                return `n("${seq[index]}").${el}`

            }
        
        });

        return struct;

    }

    private start(strudel: any, step: HTMLElement){
        
        const scheduler = strudel.scheduler;

        this.scheduler = scheduler;

        let lastStep = -1;

        const loop = () => {

            const currentStep  = this.step;

            if (currentStep !== lastStep && currentStep >= 0) {
            this._steps++;
            if(this.auto.enabled) this.autorefresh();
            lastStep = currentStep;

            const col = currentStep % 4;
            const row = Math.floor(currentStep / 4);

            step.style.transform = `translate(${col * 100}%, ${ row * 100}%)`

        }

            requestAnimationFrame(loop);
        }

        loop();

    }

}

customElements.define("ddm-main", DDM);

export default DDM;