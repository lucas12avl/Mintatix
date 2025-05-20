import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Abi } from 'viem';
import { formatEventTimestamp } from '../utils';
import { TicketInfo, TicketMetadata, TicketData} from '../MyTickets/Interfaces.ts';

//abis
import eventLogicContract from '../../contracts/EventTicketLogic.json';
//icons
import { BsFillCalendarWeekFill } from 'react-icons/bs';
import { MdLocationOn } from 'react-icons/md';

import TicketItemResale from './TicketItemResale.tsx';

import '../css/EventDetailPage.css';
import '../css/Resale/EventDetailPageResale.css'

const EventDetailPageResale = () => {

    const account = useAccount();

    const { eventAddress } = useParams<{ eventAddress: `0x${string}` }>(); //get the address of the event
    const { address: userAddress } = useAccount();

    const { data: eventURIData, isLoading: isLoadingEventUri, isError: isErrorEventUri } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'eventURI',
    });
    //OBS: the first time, this wont get the data, bc teh read will be still pending. but it's not a problem bc there is a specific retrun when all isn't loaded yet
    const sanitizedUri = String(eventURIData).replace(/^ipfs:\/\//, '');

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

    const { data: endTimeData, isLoading: isLoadingEndTime, isError: isErrorEndTime } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'eventEndTime',
    })
    const eventEndTime = Number(endTimeData);

    //the sold out its comapre the ticketsForSaleOfUsr and tokensOfOwner (the contract)
    const { data: ticketsForSaleOfUserData, isLoading: isLoadingTicketsForSaleOfUser, isError: isErrorTicketsForSaleOfUser } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'ticketsForSaleOfUsr',
        args: [account.address as `0x${string}`],
    });


    const { data: tokensOfOwnerData, isLoading: isLoadingTokensOfOwner, isError: isErrorTokensOfOwner } = useReadContract({
        address: eventAddress as `0x${string}`,
        abi: eventLogicContract.abi,
        functionName: 'tokensOfOwner',
        args: [eventAddress as `0x${string}`],

    });


    //only if the event has not finished
    const ticketsForSaleOfOtherUsrs = useMemo(() => { // if teh event is active but the tickets are sold out, the card will show a text on the photo showing this case. 
        if (ticketsForSaleOfUserData == undefined || tokensOfOwnerData == undefined) {
            return [];
        }

        if (!Array.isArray(tokensOfOwnerData) || tokensOfOwnerData.length === 0) {
            return []; //if the contract has no tickets, then it must be sold out
        }

        //if there are tickets for sale, then cheeck if the ticktes for sale is only the ticktes of the user
        //with set we can check with O(1) if a ticket is in the array or not
        const userSaleSet = new Set<BigInt>(Array.isArray(ticketsForSaleOfUserData) ? ticketsForSaleOfUserData : []);

        //if the ticket is in both arrays, descard it from the tickets for sale of OTHER users
        const ticketsForSaleOfOtherUsrs = tokensOfOwnerData.filter((tokenId) => !userSaleSet.has(tokenId));

        return ticketsForSaleOfOtherUsrs

    }, [ticketsForSaleOfUserData, tokensOfOwnerData]);

    //now with the array we have to get all the tickets info and metada for each ticket
    const ticketInfoContracts = useMemo(() => {
        //with flat map create an array with tuples like {evnet adrees [array of tokenID]} in order to interact much better insted of the object
        return ticketsForSaleOfOtherUsrs.map(id => ({
            address: eventAddress as `0x${string}`,
            abi: eventLogicContract.abi as Abi,
            functionName: 'tickets',
            args: [id],
        }));
    }, [ticketsForSaleOfOtherUsrs]);

    const { data: ticketsInfoData, isLoading: isLoadingTicketsInfo, isError: isErrorTicketsInfo } = useReadContracts({

        contracts: ticketInfoContracts,
        query: { enabled: ticketsForSaleOfOtherUsrs.length > 0 } //only reads the contract when this comes true 
    })


    const tokenURIOfTicketsContracts = useMemo(() => {
        //with flat map create an array with tuples like {evnet adrees [array of tokenID]} in order to interact much better insted of the object
        return ticketsForSaleOfOtherUsrs.map(id => ({
            address: eventAddress as `0x${string}`,
            abi: eventLogicContract.abi as Abi,
            functionName: 'tokenURI',
            args: [id],
        }));
    }, [ticketsForSaleOfOtherUsrs]);

    const { data: tokenURIOfTicketsData, isLoading: isLoadingTokenURIOfTickets, isError: isErrorTokenURIOfTickets } = useReadContracts({

        contracts: tokenURIOfTicketsContracts,
        query: { enabled: ticketsForSaleOfOtherUsrs.length > 0 } //only reads the contract when this comes true 
    })






    /* 
    writes are diferent from reads, first we prepare the write and then we have to handle the writeContract 
    adding the abi, smartContractAdress, functionName and the args 
    */
    const { data: mintTxHash, writeContract, isPending: isMintingPending, isError: isMintingError, error: mintingError } = useWriteContract();

    //mintTxHash --> The transaction hash to wait for.
    const { isLoading: isConfirming, isSuccess: isMintingSuccess } = useWaitForTransactionReceipt({ hash: mintTxHash, });

    const [eventJSON, setEventJSON] = useState<any>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [tokenURIsJSON, setTokenURIsJSON] = useState<any[] | null>(null);
    const [tokenURIsError, setTokenURIsError] = useState<string | null>(null);


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

    //useffect that creates all the ticket data and metadata for each ticket
    useEffect(() => {

        if (!tokenURIOfTicketsData) return;
        const fetchAll = async () => {
            try {
                const jsons = await Promise.all(
                    tokenURIOfTicketsData.map(async (call) => {
                        if (call.status !== 'success') return null; //if the fetch of the eventURI goes wrong set null

                        const cid = String(call.result).replace(/^ipfs:\/\//, ''); //sanitize URIS
                        const res = await fetch(`https://dweb.link/ipfs/${cid}`);

                        if (!res.ok) {
                            throw new Error(`Failed to fetch ${cid}: ${res.statusText}`);
                        }
                        return await res.json();
                    })
                );

                //we only want the correct JSON, so we have to filter the null resoved promises 
                //that we have put in the fetch when the search goes wrong
                setTokenURIsJSON(jsons.filter((j): j is any => j !== null));
                setTokenURIsError(null);

            } catch (err) { //if smtthg goes wrong fetching the info
                setTokenURIsError((err as Error).message);
                setTokenURIsJSON(null);
            }
        };
        fetchAll();
    }, [tokenURIOfTicketsData]);

    useEffect(() => { // if the transaction is success then refetch the number of tickets purchased by the user
        if (isMintingSuccess) {
            refetchPurchased();
        }
    }, [isMintingSuccess, refetchPurchased]);


    const ticketsData = useMemo<TicketData[]>(() => {
        // if the data is not loaded yet, return empty array
        if (!ticketsInfoData || !tokenURIsJSON || ticketsInfoData.length === 0 || ticketsInfoData.length !== ticketsForSaleOfOtherUsrs.length || tokenURIsJSON.length !== ticketsForSaleOfOtherUsrs.length) return [];

        let allTicketsData = ticketsForSaleOfOtherUsrs.map((id, idx) => { //the id is the tokenID of the ticket, and the idx is the index of the array --> both arrays have the same length and the same order bc the fecth is done with the same array of tokenIDs

            const infoData = ticketsInfoData[idx];
            const tokenMetadata = tokenURIsJSON[idx];

            if (infoData.status !== 'success' || !tokenMetadata) {
                return null; //if the fetch of the eventURI goes wrong set null and filter it later
            }

            const [status, pendingSince, salePrice, seller, commitHash] = infoData.result as any[];
            const ticketInfo: TicketInfo = { status, pendingSince, salePrice, seller, commitHash };

            return {
                id,
                info: ticketInfo,
                metadata: tokenMetadata as TicketMetadata,
            } as TicketData;
        });

        return allTicketsData.filter((t): t is TicketData => t !== null);


    }, [ticketsInfoData, tokenURIsJSON, ticketsForSaleOfOtherUsrs,]);

    console.log("ticketsData", ticketsData);


    const isSoldOut = ticketsForSaleOfOtherUsrs.length === 0;

    //if smthg isn't loadded or goes wrong with the smart contract reads will return this 
    const isLoading = isLoadingEventUri || isLoadingMaxTickets || isLoadingPurchased || isLoadingEndTime || isLoadingTicketsForSaleOfUser || isLoadingTokensOfOwner || isLoadingTicketsInfo || isLoadingTokenURIOfTickets ||!eventJSON;
    if (isLoading) {
        return <p className="message loading-message">Loading event details...</p>;
    }

    const isError = isErrorEventUri || isErrorMaxTickets || isErrorPurchased || isErrorEndTime || isErrorTicketsForSaleOfUser || isErrorTokensOfOwner || isErrorTicketsInfo|| isErrorTokenURIOfTickets ||fetchError || tokenURIsError;
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



    /***** varibales for the purchase logic *****/
    // the maxmun tickets that the user can buy based on the ticktes that he already bought for the event --> this not the real max tikets that the user can buy bc may be there are less stock tickets than the max allowed per account
    const remainingAllowancePerUser = (Number.isFinite(maxTicketsPerAddress)) ? Math.max(0, maxTicketsPerAddress - ticketsPurchasedCount) : Infinity;


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
                    <p>All resale tickets for this event have been purchased.</p>
                    <p>Please check back later for availability.</p>
                </div>
            );
        } else {

            //if any state has to be rendered, then render the purchase section
            return (
                <div className="content-section purchase-section">
                    <h2>Tickets Available for Resale</h2>
                    {/* message if the user reaches his purchase limit*/}
                    {remainingAllowancePerUser <= 0 && maxTicketsPerAddress !== undefined && (
                        <p className="message info-message">You have reached the purchase limit ({maxTicketsPerAddress} tickets) for your address.</p>
                    )}
                    {/*in order to show the status of the transaction and a link to see the transaction on the network (for the project will be sepolia) */}
                    {getTransactionStatus() && (
                        <p className={`message ${isMintingSuccess ? "success-message" : ""} ${isMintingError ? "error-message" : ""}`}>
                            {getTransactionStatus()}
                        </p>
                    )}
                    {mintTxHash ? (
                        <p className="transaction-hash">
                            Tx Hash: <a href={`https://sepolia.etherscan.io/tx/${mintTxHash}`} target="_blank" rel="noopener noreferrer">{mintTxHash.substring(0, 6)}...{mintTxHash.substring(mintTxHash.length - 4)}</a>
                        </p>
                    ): 
                    <div className="resale-tickets-grid">
                    {ticketsData.map((ticketData) => ( 
                        <TicketItemResale
                            key={ticketData.id.toString()}
                            ticketData={ticketData}
                            remainingAllowancePerUser={remainingAllowancePerUser}
                            isBuying={isMintingPending}
                            onBuy={(tokenId, salePrice) => { //when user clicks the button of the ticketItemResale, the writeContract will be executed with the tokenId and the salePrice of the ticket
                                writeContract({
                                    address: eventAddress as `0x${string}`,
                                    abi: eventLogicContract.abi,
                                    functionName: 'buyTicket',
                                    args: [tokenId],
                                    value: salePrice
                                });
                            }}
                        />))
                    } 

                 </div>
                    }

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
                <div className="content-section description-section">
                    <h3>Event Description</h3>
                    <p className="event-detail-description">{description || "No description available."}</p>
                    <hr></hr>
                    {Number.isFinite(maxTicketsPerAddress) && (
                        <p style={{ textAlign: "center" }}>
                            Limit per address: <strong style={{ color: "var(--text-color-light)", fontWeight: 600 }}>
                                {maxTicketsPerAddress}
                            </strong>
                        </p>
                    )}

                    <p style={{ textAlign: "center" }}>You have purchased: <strong style={{ color: "var(--text-color-light)", fontWeight: 600 }}>{ticketsPurchasedCount}</strong> tickets</p>


                </div>
                {/*render teh state ot teh status section */}
                {renderStatusOrPurchaseSection()}


            </div>
        </div>
    );

}

export default EventDetailPageResale;