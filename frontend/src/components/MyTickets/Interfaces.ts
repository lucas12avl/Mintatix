//here we have the types and interfaces that we need in orer to use the tickets 

export enum TicketStatus { Active, Pending, Redeemed }

export interface TicketMetadata { name: string; description: string; image: string; } //tokenURI JSON
export interface EventMetadata { name: string; description: string; coverImage: string; location: string; } // eventURI JSON

export interface TicketInfo { //the type of the struct that it's declared in the smart contract 

    status: TicketStatus;
    pendingSince: bigint;
    salePrice: bigint;
    seller: `0x${string}`;
    commitHash: `0x${string}`;
}

export interface TicketData { //new version with all information mixing the datat from the ERC721A like theid, the struct with all secondary datat, and the parsed JSON of the ticket.
    id: bigint;
    info: TicketInfo;
    metadata?: TicketMetadata;
}
//eventData will represent all the info of the event but with extra information of the user like the tickets that the owner have 
export interface EventData {
    address: `0x${string}`;
    endTime?: bigint;
    pendingDuration?: bigint;
    eventMetadata?: EventMetadata;
    eventMetadataLoading: boolean;
    eventMetadataError: boolean;
    ownedTickets: TicketData[];
}

//the info that the modal needs, it's better to send as props the minimum info in order to overload the component
export interface SelectedTicketState {
    eventAddress: `0x${string}`;
    tokenID: bigint;
    name: string;
    description: string;
    image: string;
    eventEndTime: bigint;
    location: string;
    ticketInfo: TicketInfo;
    pendingDurationEvent: bigint;
}

//an object with all the necessary to control the pendingTime??
export interface CountdownState {
    tokenId: string;
    eventAddress: `0x${string}`;
    startTime: number;
    duration: number;
    commitHash: `0x${string}`;
    secretNonce: `0x${string}`;
}

export type DetailedStatus = 'Active' | 'Pending' | 'Redeemed' | 'OnSale';