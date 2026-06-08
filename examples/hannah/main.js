import "drawing-drum-machine"

const ddm = document.getElementById("ddm");
const tempo = document.getElementById("tempo");

tempo.onchange = (e) => {

    ddm.tempo = e.target.value;
    
}