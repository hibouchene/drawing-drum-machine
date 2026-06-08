import FeedProcessor from "./feedProcessor"
import {UUID} from "./utils"

type ChannelSelection = {
    channel : Channel | undefined,
    toggle: HTMLElement | undefined,
    editor: HTMLTextAreaElement | undefined
}

type ChannelValueArray = [number, number, number]

class Channels extends HTMLElement{

    static instance: Channels | undefined = undefined

    elements: Array<Channel>

    editors: Array<HTMLTextAreaElement> = []

    editorsNode!: HTMLElement

    tabs!: HTMLElement

    selected: ChannelSelection = {
        channel: undefined,
        toggle: undefined,
        editor: undefined
    }

    constructor(){

        super();

        this.elements = [];

    }

    /**
     * Creates the UI when added to DOM
     */
    connectedCallback(){
        
         //Singleton check

        if(Channels.instance === undefined){
            
            Channels.instance = this;
        
        } else {

            //Removes the node

            this.remove();
            throw new Error("You cannot add more than one instance of Channels");

        }

        this.tabs = document.createElement("div");
        this.tabs.className = "tabs";

        this.editorsNode = document.createElement("div");
        this.editorsNode.className = "editors";

        const addButton = document.createElement("div");
        addButton.className = "button";
        addButton.textContent = "+";
        addButton.onclick = () => {

            this.add();

        }

        const removeButton = document.createElement("div");
        removeButton.className = "button";
        removeButton.textContent = "-"
        removeButton.onclick = () => {

            if(this.selected.channel) this.delete();

        }

        const modifyButton = document.createElement("div");
        modifyButton.className = "button";
        modifyButton.textContent = "✎";
        modifyButton.onclick = () => this.modify();

        this.tabs.append(addButton, removeButton, modifyButton);
        this.append(this.tabs, this.editorsNode)
    }

    /**
     * Adds a channel
     * @returns The created Channel
     */

    add(){

        //Generating uuid
        const id = UUID();

        //Creates new Channel object
        const c = new Channel(id);

        //Creates the UI button for channel selection
        const toggle = document.createElement("div");
        toggle.dataset.id = id;
        toggle.className = "button";
        toggle.style.backgroundColor = `rgb(${c.value.join(",")})`

        //Creates the editor textarea node

        const input = document.createElement("textarea");
        input.className="hidden";
        input.dataset.id = id;

        //Listening to click event, when clicked, we passed the channel and its button to select method
        toggle.onclick = () => {
            
            this.select(c, toggle, input);

        }

        this.tabs.append(toggle);

        this.editors.push(input);

        this.editorsNode.append(input);

        //Adding channel to channel's array
        this.elements.push(c);

        //Calling select method to immediately select the newly created channel
        this.select(c, toggle, input);

        return c;

    }

    delete(){

        //Finding an id in the channels
        const idx = this.elements.findIndex((e) => {

            return e === this.selected.channel

        });

        //If an id is found, removes the associated channel and its editor
        if(idx !== -1) {

            this.selected.toggle?.remove();

            this.selected.editor?.remove();

            this.elements.splice(idx, 1);

            this.editors?.splice(idx, 1);
       
        }

        //To avoid reselection of deleted objects, we reset selected to undefined
        this.selected = {
            channel: undefined,
            toggle: undefined,
            editor: undefined
        }

        return this;
    }

    /**
     * 
     * @param c The selected channel
     * @param t The selected toggle
     */
    select(c: Channel, t: HTMLElement, input: HTMLTextAreaElement){

        //We deselect the current selection
        this.selected.toggle?.classList.toggle("selected");

        this.selected.editor?.classList.toggle("selected");

        //We set a new selection
        this.selected = {
            channel: c,
            toggle: t,
            editor: input
        }

        //We add the selection class to the new selection
        this.selected.toggle?.classList.toggle("selected");

        this.selected.editor?.classList.toggle("selected");

    }

    /**
     * Find index of channel and editor based on id
     * @param id 
     * @returns 
     */
    find(id: string){

        const idx = this.editors.findIndex((e) => {
            
            return e.dataset.id === id;

        });

        return idx;

    }

    modify(){

        if(!this.selected.channel) throw new Error("Please select a channel first")

        FeedProcessor.instance?.pixel.then((value) => {
            if(typeof(value) !== "number" && this.selected.channel && this.selected.toggle){

                this.selected.channel.value = [value[0], value[1], value[2]]

                this.selected.toggle.style.backgroundColor = `rgb(${value[0]}, ${value[1]}, ${value[2]})`
            
            } 
        })
        
    }

    get values(): Array<string>{

        const val: Array<string> = this.editors.map((e) => {
            
            return e.value

        });

        return val;

    }
}

/**
 * Channel object, containing all the values for processing
 * It is not a custom element because it's passed to web worker so it seems better to manipulates it with Channels methods
 */
class Channel{
    _value: ChannelValueArray
    _id: string

    constructor(id: string, val: ChannelValueArray = [0, 0, 0]){

        this._value = val;
        this._id = id;

    }

    set value(val: ChannelValueArray){

        this._value = val;

    }

    get value(){

        return this._value;

    }

    get id(){

        return this._id

    }

}

customElements.define("ddm-channels", Channels);

export default Channels;