onmessage = function(e){

    const content = e.data

    const areasData = e.data.data;

    const collector = Array.from({length: content.channels.length}, () => new Array(16).fill("~"));

    // Process areas and returns number of matching pixels for each channel
    //TOTHINK: idk if we have to keep the total or if we have to stop iteration if 1 pixel is found, it can be useful if future implementations uses this for controlling amount of something

    //TOTHINK: converting to hsl instead of keeping rvb for better lightning sensitivity ?
    
    if(content.channels.length > 0){

        areasData.forEach((area, index) => {

            for(let i = 0; i < area.length; i += 4){

                const r = area[i];
                const g = area[i + 1];
                const b = area[i + 2];

                for(let j = 0; j < content.channels.length; j++){

                    const c = content.channels[j];

                    if(r >= c._value[0] - 5 && r <= c._value[0] + 5
                    && g >= c._value[1] - 5 && g <= c._value[1] + 5
                    && b >= c._value[2] - 5 && b <= c._value[2] + 5)
                    {

                        collector[j][index] = "0";

                    }

                }

            }

        })
        
    }

    const res = collector.map((row) => row.join(" "));

    this.postMessage(res);
}