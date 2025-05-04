import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { formatEventTimestamp } from '../utils';
//abis
import eventLogicContract from '../../contracts/EventTicketLogic.json';
//icons
import { BsFillCalendarWeekFill } from 'react-icons/bs';
import { MdLocationOn } from 'react-icons/md';
import { HiPlusSm } from "react-icons/hi";
import { HiMinusSm } from "react-icons/hi";

const EventDetailPage = () => {

    const { eventAddress } = useParams<{ eventAddress: `0x${string}` }>(); //get the address of the event
    const { address: userAddress } = useAccount();

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

    const { data: ticketPriceData, isLoading: isLoadingPrice, isError: isErrorPrice } = useReadContract({
        address: eventAddress,
        abi: eventLogicContract.abi,
        functionName: 'ticketPrice',
    });
    const ticketPriceWei = Number(ticketPriceData)


    const { data: maxTicketsData, isLoading: isLoadingMaxTickets, isError: isErrorMaxTickets } = useReadContract({
        address: eventAddress,
        abi: eventLogicContract.abi,
        functionName: 'maxTicketsPerAddress',
    });
    const maxTicketsPerAddress = Number(maxTicketsData); //if undefined, will be a NaN

    const { data: purchasedData, isLoading: isLoadingPurchased, refetch: refetchPurchased, isError: isErrorPurchased } = useReadContract({
        address: eventAddress,
        abi: eventLogicContract.abi,
        functionName: 'ticketsPurchased',
        args: [userAddress],
    });
    const ticketsPurchasedCount = Number(purchasedData)


    // get the max supply to represent if you can get tickets 
    const { data: maxSupplyData, isLoading: isLoadingMaxSupply, isError: isErrorMaxSupply } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'maxSupply',
    });
    const maxSupply = Number(maxSupplyData);


    const { data: totalSupplyData, isLoading: isLoadingTotalSupply, isError: isErrorTotalSupply, refetch: refetchTotalSupply } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'totalSupply',
    });
    const totalSupply = Number(totalSupplyData);

    const { data: endTimeData, isLoading: isLoadingEndTime, isError: isErrorEndTime } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'eventEndTime',
    })
    const eventEndTime = Number(endTimeData);

    /* 
    writes are diferent from reads, first we prepare the write and then we have to handle the writeContract 
    adding the abi, smartContractAdress, functionName and the args 
    */
    const { data: mintTxHash, writeContract, isPending: isMintingPending, isError: isMintingError, error: mintingError } = useWriteContract();

    //mintTxHash --> The transaction hash to wait for.
    const { isLoading: isConfirming, isSuccess: isMintingSuccess } = useWaitForTransactionReceipt({ hash: mintTxHash, });

    const [eventJSON, setEventJSON] = useState<any>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [quantity, setQuantity] = useState<number>(1); //the qamount of tickets the user wants to boy
    const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));


    /**** useEffect ****/

    //this useEffect will reRender all the componenet in order to show another state if the eventEndTime or the startPurchaseTime is bigger or smallet than the actual time
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(Math.floor(Date.now() / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

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

    // refetch this data on successful mint bc, the state has changed and is mandattory to rrepresent the right state to the user
    useEffect(() => {
        if (isMintingSuccess) {
            refetchPurchased();
            refetchTotalSupply();
            setQuantity(1);
        }
    }, [isMintingSuccess, refetchPurchased, refetchTotalSupply]);

    //if smthg isn't loadded or goes wrong with the smart contract reads will return this 
    const isLoading = isLoadingEventUri || isLoadingStartPurchaseTime || isLoadingPrice || isLoadingMaxTickets || isLoadingPurchased || isLoadingMaxSupply || isLoadingTotalSupply || isLoadingEndTime || !eventJSON;
    if (isLoading) {
        return <p className="message loading-message">Loading event details...</p>;
    }

    const isError = isErrorEventUri || isErrorStartPurchaseTime || isErrorPrice || isErrorMaxTickets || isErrorPurchased || isErrorMaxSupply || isErrorTotalSupply || isErrorEndTime || fetchError
    if (isError) {
        return <p className="message error-message">Error loading contract data. Please try again.</p>;
    }


    /***** parsed JSON *****/
    const coverImage = (eventJSON?.coverImage ?? '').replace(/^ipfs:\/\//, '');
    const name = (eventJSON?.name ?? '')
    const location = (eventJSON?.location ?? '')
    const formattedDate = formatEventTimestamp(Number(eventEndTime));
    const description = (eventJSON?.detailedDescription ?? '')

    /***** status of the event *****/
    const isEventFinished = Number.isFinite(eventEndTime) ? currentTime >= eventEndTime : false;

    //only can be comingSoon if it's not finished yet
    const isComingSoon = !isEventFinished && Number.isFinite(startPurchaseTime) ? currentTime < startPurchaseTime : false;

    //the remaining supply or undefined if the call to the smart contract it's not finished.
    const remainingSupply = Number.isFinite(maxSupply) && Number.isFinite(totalSupply) ? Math.max(0, maxSupply - totalSupply) : undefined;

    //only if the event has not finished
    const isSoldOut = !isEventFinished && remainingSupply !== undefined && remainingSupply <= 0;

    const lowSupplyThreshold = Number.isFinite(maxSupply) ? Math.floor(maxSupply * 0.25) : 0;

    //only if it's not soldOut (soldOut checks if its not finished)
    const isLowSupply = !isSoldOut && remainingSupply !== undefined && remainingSupply > 0 && remainingSupply <= lowSupplyThreshold;



    /***** varibales for the purchase logic *****/
    // the maxmun tickets that the user can buy based on the ticktes that he already bought for the event --> this not the real max tikets that the user can buy bc may be there are less stock tickets than the max allowed per account
    const remainingAllowancePerUser = (Number.isFinite(maxTicketsPerAddress)) ? Math.max(0, maxTicketsPerAddress - ticketsPurchasedCount) : Infinity;

    //the maximun tickets the user can buy: it's the minimum bethween the maximun tikcets per address and the actual stock
    const effectiveMaxQuantity = (!isEventFinished && !isSoldOut && remainingSupply !== undefined) ? Math.min(remainingAllowancePerUser, remainingSupply) : 0;


    /**** user input modifiers ****/

    const incrementQuantity = () => {
        if (quantity < effectiveMaxQuantity) {
            setQuantity(quantity + 1);
        }
    };

    const decrementQuantity = () => {
        if (quantity > 1) {
            setQuantity(quantity - 1);
        }
    };

    const handlePurchase = () => {
        if (!eventAddress || !Number.isFinite(ticketPriceWei) || quantity <= 0 || !Number.isFinite(maxTicketsPerAddress) || isEventFinished || isSoldOut || !Number.isFinite(remainingSupply) || remainingSupply === undefined) return;

        if (quantity > remainingAllowancePerUser) { //just in case the user modifies the quantity manually 
            alert(`You can only purchase ${remainingAllowancePerUser} more tickets (Max per address: ${maxTicketsPerAddress}, You have: ${ticketsPurchasedCount}).`);
            return;
        }
        if (quantity > remainingSupply) { //just in case the user modifies the quantity manually 
            alert(`Only ${remainingSupply} tickets are left in total. Please reduce the quantity.`);
            return;
        }

        writeContract({
            address: eventAddress,
            abi: eventLogicContract.abi,
            functionName: 'mintTickets',
            args: [BigInt(quantity)],
            value: BigInt(ticketPriceWei) * BigInt(quantity),
        });
    };

    const formattedPrice = ticketPriceWei ? formatUnits(BigInt(ticketPriceWei), 18) : '...';
    const subtotalWei = ticketPriceWei ? BigInt(ticketPriceWei) * BigInt(quantity) : BigInt(0);
    const formattedSubtotal = formatUnits(subtotalWei, 18);

    //the message that the user will see based on the actual status 
    const getTransactionStatus = () => {
        if (isMintingPending) return "Sending transaction...";
        if (isConfirming) return "Waiting for confirmation...";
        if (isMintingSuccess) return "Purchase successful!";
        if (isMintingError) return `Purchase error: ${mintingError?.message || 'Unknown error'}`;
        return null;
    };

    const renderStatusOrPurchaseSection = () => {
        // status order:  finished --> sold out --> coming soon --> purchase active

        if (isEventFinished) {
            return (
                <div className="content-section status-section event-finished-section">
                    <h2>Event Finished</h2>
                    <p>This event has already concluded.</p>
                </div>
            );
        } else if (isSoldOut) {
            return (
                <div className="content-section status-section sold-out-section">
                    <h2>Sold Out</h2>
                    <p>All tickets for this event have been purchased.</p>
                </div>
            );
        } else if (isComingSoon) {
            return (
                <div className="content-section status-section coming-soon-section">
                    <h2>Coming Soon</h2>
                    <p>Ticket sales will begin on: <br /> <strong>{formatEventTimestamp(startPurchaseTime)}</strong></p>
                </div>
            );
        } else {

            //if any state has to be rendered, then render the purchase section
            return (
                <div className="content-section purchase-section">
                    <h2>Purchase Tickets</h2>
                    {isLowSupply && (
                        <p className="low-supply-warning">Only {remainingSupply} tickets left!</p>
                    )}

                    <div className="ticket-info">
                        <p>Price per ticket: <strong>{formattedPrice} ETH</strong></p>

                        {maxTicketsPerAddress < maxSupply && (
                            <p>Limit per address: <strong>{maxTicketsPerAddress}</strong></p>
                        )}
                        
                        <p>You have purchased: <strong>{ticketsPurchasedCount}</strong> tickets</p>
                        
                    </div>

                    {/* if there are tickets in stock then show this  */}
                    {effectiveMaxQuantity > 0 && (

                        <div className="purchase-form">

                            <label htmlFor="quantity-display" className="quantity-label">Quantity:</label>

                            <div className="quantity-selector">
                                <button
                                    className="quantity-button"
                                    onClick={decrementQuantity} // the handle to decremt the useState variable 
                                    disabled={quantity <= 1}
                                    aria-label="Decrease quantity"
                                ><HiMinusSm /></button>

                                <span id="quantity-display" className="quantity-display" aria-live="polite">{quantity}</span>
                                <button
                                    className="quantity-button"
                                    onClick={incrementQuantity} // the handle to increment the useState variable 
                                    disabled={quantity >= effectiveMaxQuantity || effectiveMaxQuantity <= 0}
                                    aria-label="Increase quantity"
                                ><HiPlusSm /></button>
                            </div>

                            {remainingAllowancePerUser !== Infinity && effectiveMaxQuantity < remainingAllowancePerUser && (
                                <p className="message info-message">
                                    You can buy a maximum of {Math.min(remainingAllowancePerUser, remainingSupply ?? Infinity)} tickets due to stock limitations.
                                </p>
                            )}

                            <p className="subtotal">Subtotal: <strong>{formattedSubtotal} ETH</strong></p>
                            <button
                                className="button button-primary"
                                onClick={handlePurchase}
                                //the purchase button will be dissabled if the transaction it's going to fail
                                disabled={isMintingPending || isConfirming || quantity <= 0 || quantity > effectiveMaxQuantity || effectiveMaxQuantity <= 0}
                            >
                                {isMintingPending || isConfirming ? "Processing..." : "Purchase Tickets"}
                            </button>
                        </div>
                    )}

                    {/* message if the user reaches his purchase limit*/}
                    {remainingAllowancePerUser <= 0 && maxTicketsPerAddress !== undefined && (
                        <p className="message info-message">You have reached the purchase limit ({maxTicketsPerAddress} tickets) for your address.</p>
                    )}
                    {/* if the user cant purchase more tickets */}
                    {effectiveMaxQuantity <= 0 && remainingAllowancePerUser > 0 && (
                        <p className="message info-message">No more tickets available to purchase.</p>
                    )}
                    {/*in order to show the status of the transaction and a link to see the transaction on the network (for the project will be sepolia) */}
                    {getTransactionStatus() && (
                        <p className={`message ${isMintingSuccess ? "success-message" : ""} ${isMintingError ? "error-message" : ""}`}>
                            {getTransactionStatus()}
                        </p>
                    )}
                    {mintTxHash && (
                        <p className="transaction-hash">
                            Tx Hash: <a href={`https://sepolia.etherscan.io/tx/${mintTxHash}`} target="_blank" rel="noopener noreferrer">{mintTxHash.substring(0, 6)}...{mintTxHash.substring(mintTxHash.length - 4)}</a>
                        </p>
                    )}
                </div>
            );
        }
    };

    return (
        <div className="event-detail-page page-container">
            <div className="event-header">
                <img

                    className="event-banner-image"
                    src={`https://ipfs.io/ipfs/${coverImage}`}
                    alt={`${name || 'Event'} banner`}
                />

                <h1 className="event-title-main">{name || 'Event Details'}</h1>

                <div className="event-meta">
                    <p>
                        <BsFillCalendarWeekFill aria-hidden="true" />
                        {formattedDate}
                    </p>
                    <p>
                        <MdLocationOn aria-hidden="true" />
                        {location || 'Location TBD'}
                    </p>
                </div>
            </div>


            <div className="event-content-area">
                {/*render teh state ot teh status section */}
                {renderStatusOrPurchaseSection()}

                <div className="content-section description-section">
                    <h3>Event Description</h3>
                    <p className="event-detail-description">{description || "No description available."}</p>
                </div>
            </div>
        </div>
    );

}

export default EventDetailPage;