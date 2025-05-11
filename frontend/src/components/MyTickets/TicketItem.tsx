import type { TicketData } from './Interfaces.ts';
import { TicketStatus } from './Interfaces.ts';

import { useAccount, useReadContract} from 'wagmi';
import {useState, useEffect } from 'react';
import logicContract from '../../contracts/EventTicketLogic.json'
import { TicketMetadata } from './Interfaces.ts';

const TicketItem = ({ eventAddress, ticket, pendingDuration, onClick }: { eventAddress: `0x${string}`, ticket: TicketData, pendingDuration: bigint, onClick: (d: {ticket: TicketData; metadata: TicketMetadata | null; imageUrl: string | undefined}) => void }) => {

    const { address: userAddress } = useAccount();
    const [pendingExpired, setPendingExpired] = useState(false);
    useEffect(() => { //create a timer and when the timer finishes return to Active without calling the contract
        if (ticket.info.status !== TicketStatus.Pending) {
            setPendingExpired(false);
            return;
        }

        const now = BigInt(Math.floor(Date.now() / 1000));
        const expires = ticket.info.pendingSince + pendingDuration;
        const timeLeft = Number(expires > now ? expires - now : 0n) * 1000;

        if (timeLeft === 0) {
            setPendingExpired(true);
        } else {

                setPendingExpired(false);
            
            const id = setTimeout(() => setPendingExpired(true), timeLeft);
            return () => clearTimeout(id);
        }
    }, [ticket.info.status, ticket.info.pendingSince, pendingDuration]);

    const { data: tokenUriData} = useReadContract({ // it's unncesessary the isLoading or isError bc it's controled by the useState eventJSON and fetchError

        address: eventAddress,
        abi: logicContract.abi,
        functionName: 'tokenURI',
        args: [ticket.id],
        query: { staleTime: 24 * 60 * 60 * 1000 }, //the uri can change but is unusual, so, it can be consider stale like 24h 
    });

    const [metadata, setMetadata] = useState<TicketMetadata | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    useEffect(() => {
        const fetchEventData = async () => { // the data defaults to undefined, if is still undefined we cant fetch the data
            if (!tokenUriData) return;
            try {
                const sanitizedUri = String(tokenUriData).replace(/^ipfs:\/\//, '');
                const response = await fetch(`https://dweb.link/ipfs/${sanitizedUri}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch event data: ${response.statusText}`);
                }
                const data = await response.json();
                setMetadata(data);
                setFetchError(null);
            } catch (error) {
                setFetchError((error as Error).message);
            }
        };
        fetchEventData();
    }, [tokenUriData]);
    const NFTImage = (metadata?.image ?? '').replace(/^ipfs:\/\//, '')
    const imageUrl = `https://ipfs.io/ipfs/${NFTImage}`


    //not necessary to fetch the tokenURI. its included in every ticket

    let status: 'Loading' | 'Pending' | 'Active' | 'Redeemed' | 'On Sale';

    if (ticket.info.seller === userAddress && ticket.info.salePrice !== 0n) {
        status = 'On Sale';
    } else if (ticket.info.status === TicketStatus.Redeemed) {
        status = 'Redeemed';
    } else if (ticket.info.status === TicketStatus.Pending && !pendingExpired) {
        status = 'Pending';
    } else {
        status = 'Active';
    }
    // sanitize the state according to the css class created
    const statusClass = `status-${status.toLowerCase().replace(/\s+/g, '')}`;


    return (
        <div
            className="my-tickets-ticket-item"
            role="button"
            tabIndex={0}
            onClick={() => onClick({ ticket, metadata, imageUrl })} //this inclick will execute the fun
        >
            <div className="my-tickets-ticket-image-container">
                {metadata && !fetchError
                    ? <img src={imageUrl} alt={ticket.metadata?.name ?? ''} className="my-tickets-ticket-image" />
                    : <div className="my-tickets-ticket-placeholder">Img N/A</div>}
            </div>
            <div className="my-tickets-ticket-details">
                <p>{`Ticket ID: ${ticket.id}`}</p>
                <p className={`my-tickets-ticket-status ${statusClass}`}>Status: {status}</p>
            </div>
        </div>
    );
}

export default TicketItem;