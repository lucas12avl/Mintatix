import { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { formatEventTimestamp} from '../utils';
//abi
import eventLogicContract from '../../contracts/EventTicketLogic.json';
//icons
import { BsFillCalendarWeekFill } from 'react-icons/bs';
import { MdLocationOn } from 'react-icons/md';


const FirstEventCard = ({ eventAddress, eventEndTime }: { eventAddress: string, eventEndTime: bigint }) => {

    //get the eventURI from the evntAddress to represent the info of the event
    const { data: eventURIData, isLoading: isLoadingEventUri, isError: isErrorEventUri } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'eventURI',
    });
    //OBS: the first time, this wont get the data, bc teh read will be still pending. but it's not a problem bc there is a specific retrun when all isn't loaded yet
    const sanitizedUri = String(eventURIData).replace(/^ipfs:\/\//, '');

    //get the stratPurchaseTime from the eventAddress to represent the info of the event
    const { data: startPurchaseTimeData, isLoading: isLoadingStartPurchaseTime, isError: isErrorStartPurchaseTime } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'startPurchaseTime',
    });
    const startPurchaseTime = Number(startPurchaseTimeData);


    // get the max supply to represent if you can get tickets 
    const { data: maxSupplyData, isLoading: isLoadingMaxSupply, isError: isErrorMaxSupply } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'maxSupply',
    });
    const maxSupply = Number(maxSupplyData);


    const { data: totalSupplyData, isLoading: isLoadingTotalSupply, isError: isErrorTotalSupply } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'totalSupply',
    });
    const totalSupply = Number(totalSupplyData);

    const [eventJSON, setEventJSON] = useState<any>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    //OBS: the async fetch will be here bc, react doesn't allow async functions when it'srendering the objetcs
    // so it's necessary to have a placeholder, (in this case when all the smart contract calls are not finished, this component returns something different)
    // that will be repalced by the real visuals when all data is fetched
    useEffect(() => {
        const fetchEventData = async () => {
            if (!eventURIData) return; // the data defaults to undefined, if is still undefined we cant fetch the data
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

    //when the user clicks teh eventCard, then we jump to the eventDetail page  (it has to be before the return statement bc is a hook)
    const navigate = useNavigate();

    //if the event is loading 
    if (isLoadingEventUri || isLoadingStartPurchaseTime || isLoadingMaxSupply || isLoadingTotalSupply || !eventJSON) {
        return <p>Loading event information...</p>;
    }

    //if something goes wrong with the event data
    if (isErrorEventUri || isErrorStartPurchaseTime || isErrorMaxSupply || isErrorTotalSupply || fetchError) {
        return <p>Error loading the event:{fetchError || 'Contract error'}</p>;
    }

    // all the data from the json of the event
    const coverImage = (eventJSON?.coverImage ?? '').replace(/^ipfs:\/\//, '');
    const detailedDescription = (eventJSON?.detailedDescription ?? '')
    const name = (eventJSON?.name ?? '')
    const location = (eventJSON?.location ?? '')

    //props to the eventDetailPage
    const handleEntradasClick = () => {
        navigate(`/event/${eventAddress}`)
    };

    function ButtonLabel() { //the state of the button depends on the time of the event and if the tickets are sold out or not
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime < startPurchaseTime) {
            return <>Coming soon</>
        }
        else if (maxSupply === totalSupply) {
            return <> Sold out</>
        }
        else {
            return <> Tickets</>
        }
    }

    const formattedDate = formatEventTimestamp(Number(eventEndTime));

    return (
        <div className="first-event-card">
            <div className="first-event-image-wrapper">
                <img
                    src={`https://dweb.link/ipfs/${coverImage}`}
                    alt={`${name || 'Event'} cover`}
                    className="first-event-image"
                />
            </div>

            <div className="first-event-content">
                <h2>{name}</h2>

                <div className="event-info">
                    <p>
                        <BsFillCalendarWeekFill style={{ verticalAlign: '-2px', marginRight: '10px' }} />
                        {formattedDate}
                    </p>
                    <p>
                        <MdLocationOn style={{ verticalAlign: '-2px', marginRight: '10px' }} />
                        {location}
                    </p>
                </div>

                <p className="first-description">{detailedDescription}</p>

                <button className="button" onClick={handleEntradasClick}>
                    {ButtonLabel()}
                </button>
            </div>
        </div>
    );
}

export default FirstEventCard;