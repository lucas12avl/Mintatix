import { useState, useEffect, useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { formatEventTimestamp, formatLocation } from '../utils';
//abi
import eventLogicContract from '../../contracts/EventTicketLogic.json';
//icons
import { MdLocationOn } from 'react-icons/md';
import { BsFillCalendarWeekFill } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';

import '../css/EventCard.css';

const EventCard = ({ eventAddress, eventEndTime }: { eventAddress: string, eventEndTime: bigint }) => {

    const { data: eventURIData, isLoading: isLoadingEventUri, isError: isErrorEventUri } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'eventURI',
    });
    //OBS: the first time, this wont get the data, bc teh read will be still pending. but it's not a problem bc there is a specific retrun when all isn't loaded yet
    const sanitizedUri = String(eventURIData).replace(/^ipfs:\/\//, '');

    const { data: maxSupplyData, isLoading: isLoadingMaxSupply, isError: isErrorMaxSupply } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'maxSupply',
    });


    const { data: totalSupplyData, isLoading: isLoadingTotalSupply, isError: isErrorTotalSupply } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'totalSupply',
    });



    const [eventJSON, setEventJSON] = useState<any>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    //OBS: the async fetch will be here bc, react doesn't allow async functions when it'srendering the objetcs
    // so it's necessary to have a placeholder, (in this case when all the smart contract calls are not finished, this component returns something different)
    // that will be repalced by the real visuals when all data is fetched
    useEffect(() => {
        const fetchEventData = async () => { // the data defaults to undefined, if is still undefined we cant fetch the data
            if (!eventURIData) return;
            try {
                const response = await fetch(`https://dweb.link/ipfs/${sanitizedUri}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch event data: ${response.statusText}`);
                }
                const data = await response.json();
                setEventJSON(data);
                setFetchError(null);
            } catch (error) {
                setFetchError((error as Error).message);
            }
        };
        fetchEventData();
    }, [eventURIData]);

    const isSoldOut = useMemo(() => { // if teh event is active but the tickets are sold out, the card will show a text on the photo showing this case. 
        if (totalSupplyData == null || maxSupplyData == null || maxSupplyData === 0n)
            return false;

        return totalSupplyData >= maxSupplyData;
    }, [totalSupplyData, maxSupplyData]);

    const navigate = useNavigate();
   

    const isLoading = isLoadingEventUri || isLoadingMaxSupply || isLoadingTotalSupply || !eventJSON;
    if (isLoading) {
        return (
            <div className="event-card loading">
                <p>Loading Event...</p>
            </div>
        );
    }

    const isError = isErrorEventUri || isErrorMaxSupply || isErrorTotalSupply || fetchError;
    if (isError) {
        return (
            <div className="event-card error">
                <p>Error loading event data:</p>
                <p>{fetchError || 'Contract read error'}</p>
            </div>
        );
    }

    const coverImage = (eventJSON?.coverImage ?? '').replace(/^ipfs:\/\//, '');
    const name = (eventJSON?.name ?? '')
    const location = (eventJSON?.location ?? '')
    const formattedDate = formatEventTimestamp(Number(eventEndTime));

    const handleCardClick = () => {
        navigate(`/event/${eventAddress}`)
    };

    return (
        <div className={`event-card${isSoldOut ? ' sold-out' : ''}`} onClick={handleCardClick}>
            <div className="event-image-container">
                {coverImage ? (
                    <img
                        src={`https://ipfs.io/ipfs/${coverImage}`}
                        alt={`${name} cover`}
                        className="event-image"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = '/placeholder-image.jpg';
                            target.alt = 'Image not found';
                        }}
                    />
                ) : (
                    <div className="event-image placeholder">
                        {isLoading ? 'Loading...' : 'Image Missing'}
                    </div>
                )}
                {isSoldOut && (
                    <div className="sold-out-overlay">
                        <span className="sold-out-text">Sold Out</span>
                    </div>
                )}
            </div>

            <div className="event-card-content">
                <div className="event-title">
                    <h3>{name}</h3>
                </div>
                <div className="event-details">
                    <p>
                        <BsFillCalendarWeekFill aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: '8px' }} />
                        {formattedDate}
                    </p>
                    <p>
                        <MdLocationOn aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: '8px' }} />
                        {formatLocation(location)}
                    </p>
                </div>
            </div>
        </div>
    );
}
export default EventCard;