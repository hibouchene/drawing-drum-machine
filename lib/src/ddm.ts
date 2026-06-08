/**
 * Base class for drawing drum machine
 */

import { initStrudel, samples, getAudioContext, evaluate } from '@strudel/web';


import Channels from "./channels";
import FeedProcessor from "./feedProcessor";


class DDM extends HTMLElement{
    cpm: number = 120;
    audioContext: AudioContext | undefined

    constructor(){
        super();

    }

    connectedCallback(){
        

        const step = document.createElement("div");
        step.className = "step";

        const samplesAttribute = this.getSamples();

        let processor: FeedProcessor;

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

        //Checks if all required web components are in place in the DOM
        const channels = Channels.instance;

        if(!channels) throw new Error("There is no channels");

        /**
         * The video element that will show the video feed
         */
        this.initVideo().then((video) => {

            this.append(video, step);

            this.audioContext = getAudioContext();

            processor = new FeedProcessor(video);

             //User CTRL+S event for getting image data and evaluate sound from its computed sequence
            window.addEventListener("keydown", (e) => {

                    if(e.key === "s" && e.ctrlKey){

                        //To avoid the default save window
                        e.preventDefault();

                        //We the sequence (async) and use it for strudel evaluation (see refresh method)
                        processor.seq(channels).then((seq) => {

                            const struct = this.codesToStruct(seq, channels.values)

                            this.refresh(struct);

                        });
                        

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

        let lastStep = -1;

        const loop = () => {

            const currentStep  = this.calcCurrentStep(scheduler);

            if (currentStep !== lastStep) {
            lastStep = currentStep;

            const col = currentStep % 4;
            const row = Math.floor(currentStep / 4);

            step.style.transform = `translate(${col * 100}%, ${ row * 100}%)`

        }

            requestAnimationFrame(loop);
        }

        loop();

    }

    calcCurrentStep(scheduler: any){

        const now = scheduler.getTime();

        const secondsAtChange = scheduler.seconds_at_cps_change;
        const cyclesAtChange = scheduler.num_cycles_at_cps_change;
        const currentCPS = scheduler.cps;

        const absoluteCycle = cyclesAtChange + (now - secondsAtChange) * currentCPS;

        const currentStep = Math.floor((absoluteCycle % 1) * 16);

        return currentStep;

    }

    set tempo(value: number){

        this.cpm = value;

    }
}

customElements.define("ddm-main", DDM);

export default DDM;