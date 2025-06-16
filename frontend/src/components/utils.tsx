export const formatEventTimestamp = (unixSeconds: number): string => {
    try {
        const date = new Date(Number(unixSeconds) * 1000); //convert into an object date
        //then put the date and time in a clear format
        return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) +
            ', ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    catch (e) {
        console.error("error formatting event date:", e);
        return 'Invalid date?';
    }

};
//this fucntion splits the location string in two parts,  building | city,country -->
//bc sometimes tehre are cards that is all teh location in one line and others in two lines, 
//so for aesthetic purposes its better to split and give more space to the building name 
export const formatLocation = (location: string) => {
    
    if (!location) return 'Loading location...';

    const commaIndex = location.indexOf(',');

    if (commaIndex === -1) return <>{location}</>;

    const firstPart = location.substring(0, commaIndex + 1);
    const secondPart = location.substring(commaIndex + 1).trim();

    return <>{firstPart}<br />{secondPart}</>;
};