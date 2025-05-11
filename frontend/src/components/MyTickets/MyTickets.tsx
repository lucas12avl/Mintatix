import { useState, useMemo, useEffect } from 'react';
import { useReadContract, useReadContracts, useAccount } from 'wagmi';

import factoryContract from '../../contracts/EventTicketFactory.json';
import factoryAddr from '../../contracts/FactoryAddress.json';

import eventLogicContract from '../../contracts/EventTicketLogic.json';
import logicAddr from '../../contracts/LogicAddress.json';

import type { Abi } from 'abitype';

import { EventData, TicketData, TicketStatus, TicketInfo, TicketMetadata, EventMetadata, SelectedTicketState } from './Interfaces.ts';

import EventAccordion from './EventAccordion.tsx';
import PageTitle from '../PageTitle.tsx';
import TicketDetailModal from './TicketDetailModal.tsx';

const MyTickets = () => {

    const { address: userAddress } = useAccount();

    const [activeTab, setActiveTab] = useState<'active' | 'onSale' | 'finished'>(() => {

        const stored = localStorage.getItem('myTicketsActiveTab');
        return stored === 'onSale' || stored === 'finished' ? stored : 'active';
    }); //when the user actibate the component the default will be the active tab, but if teh user reloads, the localStoratge will provide the last tab the user has seen

    useEffect(() => { //this will set the localStorge to rememeber the last active tab of the user
        localStorage.setItem('myTicketsActiveTab', activeTab);
    }, [activeTab]);

    const [selected, setSelected] = useState<SelectedTicketState | null>(null); //the selected ticket state will help to save the ticket info thath we want to show in the modal
    //first of all, we have to read all the smart contract addresses
    const { data: allEventsData, isLoading: isLoadingEvents, isError: isErrorEvents } = useReadContract({
        abi: factoryContract.abi,
        address: factoryAddr.address as `0x${string}`,
        functionName: 'getEvents'
    });
    // allEventsData is an array like ['0xblablablableblebleblublublu', '0xblablablableblebleblublublu', ....]

    //now we have to convert all the strings event address, into 0x strings in order to use it later to read the contracts
    const allEvents: `0x${string}`[] = useMemo(() => {

        if (Array.isArray(allEventsData)) { // allEventsData can be null or undefined, we have to make sure is an array and have smthg

            return allEventsData as `0x${string}`[];

        }
        return [];

    }, [allEventsData]);

    //this pending duration is the same for every event contract, so we can use it for all events
    const { data: pendingDurationData, isLoading: isLoadingPendingDuration, isError: isErrorPendingDuration } = useReadContract({
        abi: eventLogicContract.abi,
        address: logicAddr.address as `0x${string}`,
        functionName: 'pendingDuration'
    });


    //get the end time of all events 
    const eventEndTimeContracts = useMemo(() => {

        return allEvents.map((eventAddress) => ({

            address: eventAddress,
            abi: eventLogicContract.abi as Abi, //here wen need to put the abi type, bc the wagmi hook that reads multiple contracts at once needs that this object the abi has to be Abi type (read doc)
            functionName: 'eventEndTime',
        }));

    }, [allEvents])


    /*OBS useReadContracts returns: 
    an Array of objects [{…}, {…}, {…}, {…}]
    inside of the object --> {result: >the data obtained>  status: "success"} 
    */
    const { data: eventEndTimesData, isLoading: isLoadingEventEndTimes, isError: isErrorEventEndTimes } = useReadContracts({

        contracts: eventEndTimeContracts,
        query: { enabled: allEvents.length > 0 } //only reads the contract when this comes true 
    })


    /*****search all the events where the user have tickets, this include: tokensOfOwner and ticketsForSaleOfUsr *****/

    const ticketsOfOwnerContracts = useMemo(() => {

        return allEvents.map((eventAddress) => ({

            address: eventAddress,
            abi: eventLogicContract.abi as Abi, //here wen need to put the abi type, bc the wagmi hook that reads multiple contracts at once needs that this object the abi has to be Abi type (read doc)
            functionName: 'tokensOfOwner',
            args: [userAddress]

        }));

    }, [allEvents])

    //search the tickets where the user is the owner --> get an object with an array, then iterate all the array to know on evry event, which ticktes are this user the owner
    const { data: ticktesOfOwnerData, isLoading: isLoadingTicktesOfOwner, isError: isErrorTicktesOfOwner, refetch: refetchTicktesOfOwner } = useReadContracts({

        contracts: ticketsOfOwnerContracts,
        query: { enabled: !isLoadingEvents && allEvents.length > 0 } //only reads the contract when this comes true 
    }) //the first object with a bigint tokenID will represent the rellevantAddress in order to know to which rellevantAdreess belongs

    //search the ticktes that the user is not the owner bc the ticktes are onSale 
    const ticketsOfOwnerOnSaleContracts = useMemo(() => {

        return allEvents.map((eventAddress) => ({

            address: eventAddress,
            abi: eventLogicContract.abi as Abi, //here wen need to put the abi type, bc the wagmi hook that reads multiple contracts at once needs that this object the abi has to be Abi type (read doc)
            functionName: 'ticketsForSaleOfUsr',
            args: [userAddress]

        }));

    }, [allEvents])

    const { data: ticktesOfOwnerOnSaleData, isLoading: isLoadingTicktesOfOwnerOnSale, isError: isErrorTicktesOfOwnerOnSale, refetch: refetchTicktesOfOwnerOnSale } = useReadContracts({

        contracts: ticketsOfOwnerOnSaleContracts,
        query: { enabled: !isLoadingEvents && allEvents.length > 0 } //only reads the contract when this comes true 
    })  //the first object with a bigint tokenID will represent the rellevantAddress in order to know to which rellevantAdreess belongs


    /*********** get the eventUri of all events to put them in the eventData: Metadata ***********/
    const eventUriOfEvents = useMemo(() => {

        return allEvents.map((eventAddress) => ({

            address: eventAddress,
            abi: eventLogicContract.abi as Abi, //here wen need to put the abi type, bc the wagmi hook that reads multiple contracts at once needs that this object the abi has to be Abi type (read doc)
            functionName: 'eventURI',
        }));

    }, [allEvents])

    const { data: eventUrisData, isLoading: isLoadingEventUris, isError: isErrorEventUris } = useReadContracts({

        contracts: eventUriOfEvents,
        query: { enabled: allEvents.length > 0 } //only reads the contract when this comes true 
    })

    const [EventsJSON, setEventsJSON] = useState<any[] | null>(null); //[{…}, {…}, ...] --> {name , deteiledDescription, coverImage} eventURI of every event
    const [fetchError, setFetchError] = useState<string | null>(null); // if smthg fails will represented here



    useEffect(() => {

        if (!eventUrisData) return;

        const fetchAll = async () => {

            try {
                const jsons = await Promise.all(

                    eventUrisData.map(async (call) => {
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
                setEventsJSON(jsons.filter((j): j is any => j !== null));
                setFetchError(null);

            } catch (err) { //if smtthg goes wrong fetching the info
                setFetchError((err as Error).message);
                setEventsJSON(null);
            }
        };

        fetchAll();
    }, [eventUrisData]);




    //now get a structure with the address as key and the value is an array of tokens id 
    const allRelevantTicketIdsByEvent = useMemo(() => {
        // record is like a mapping, with a tuple of key value where the key will be the address of the contract 
        const combined: Record<`0x${string}`, bigint[]> = {};

        ticktesOfOwnerData?.forEach((ticket, i) => {

            const addr = allEvents[i];
            if (ticket?.status === 'success' && Array.isArray(ticket.result)) {
                combined[addr] = combined[addr] || []; //the key
                combined[addr].push(...(ticket.result as bigint[])); // //OBS: the <...> equals to ticket.result[0], ticket.result[1]... --> push one by one all the content 
            }
        });

        ticktesOfOwnerOnSaleData?.forEach((ticket, i) => {
            const addr = allEvents[i];
            if (ticket?.status === 'success' && Array.isArray(ticket.result)) {
                combined[addr] = combined[addr] || []; //the initial will be the last if there are smthg or a void array
                combined[addr].push(...(ticket.result as bigint[]));
            }
        });

        return combined;
    }, [ticktesOfOwnerData, ticktesOfOwnerOnSaleData, allEvents]);

    //now for every tokenID we have to search all the realted information --> TicketInfo
    const ticketInfoContracts = useMemo(() => {
        //with flat map create an array with tuples like {evnet adrees [array of tokenID]} in order to interact much better insted of the object
        return Object.entries(allRelevantTicketIdsByEvent).flatMap(
            ([address, ids]) =>
                ids.map(id => ({
                    address: address as `0x${string}`,
                    abi: eventLogicContract.abi as Abi,
                    functionName: 'tickets',
                    args: [id],
                }))
        );
    }, [allRelevantTicketIdsByEvent]);

    const { data: ticketInfosData, isLoading: isLoadingTicketInfos, isError: isErrorTicketInfos, refetch: refetchTicketInfos } = useReadContracts({
        contracts: ticketInfoContracts,
        query: { enabled: ticketInfoContracts.length > 0, staleTime: 0 }



        // in order to not call the tickets info every time the component renders, the info will stay al least 10 min
        //it's important to have the state of the tickets updated, so, the states will be recalculated every 10min
        //OBS: both are only for automatic fetch, so if teh refetch is called, then will fetch the info again
    });

    const ticketInfoMap = useMemo(() => {//this map will have as a key <0x...>-<ticketID>

        //better to use record in ordeer to get easily access to the data bc the key is the event
        const map: Record<string, TicketInfo> = {};

        //use the array of calls bc this one have the exact address, so later get the resposne (same length)
        ticketInfoContracts.forEach((call, i) => {
            const res = ticketInfosData?.[i]; //get the response of the lecture
            if (res?.status === 'success' && Array.isArray(res.result)) {

                map[`${call.address}-${call.args[0]}`] = { //<0x...>-<ticketID>

                    status: Number(res.result[0]) as TicketStatus,
                    pendingSince: res.result[1] as bigint,
                    salePrice: res.result[2] as bigint,
                    seller: res.result[3] as `0x${string}`,
                    commitHash: res.result[4] as `0x${string}`,
                };
            }
        });

        return map;
    }, [ticketInfosData, ticketInfoContracts]);

    //now get the EventUri of all events and fetch
    const eventMetadataMap = useMemo<Record<`0x${string}`, EventMetadata | undefined>>(() => {

        if (!EventsJSON) return {};

        return Object.fromEntries( //returns as an object an array of [key, value] transforming it in { 0x7b8...: {name: zzz, description: zzz, coverImage: zzz, location: zzz}}
            allEvents.map((addr, idx) => {
                const meta = EventsJSON[idx];
                if (!meta) return [addr, undefined]; // if the metadata is not loaded put undefined 

                //this array as obj
                return [
                    addr,
                    {
                        name: meta.name ?? '',
                        description: meta.detailedDescription ?? '',
                        coverImage: (meta.coverImage ?? '').replace(/^ipfs:\/\//, ''),
                        location: meta.location ?? '',
                    } as EventMetadata,
                ];
            }),
        );
    }, [allEvents, EventsJSON]);


    //if arrived, all the data is fetched and structured so, we can now represent teh events with the tickets to the user  
    const { activeEvents, onSaleEvents, finishedEvents } = useMemo(() => {
        //this will make more easily to represent the 3 types of tabs 
        const active: EventData[] = [];
        const onSale: EventData[] = [];
        const finished: EventData[] = [];

        const nowSec = BigInt(Math.floor(Date.now() / 1000));

        allEvents.forEach((addr, i) => {

            //the pending duration is the same for all events
            const pd = typeof pendingDurationData === 'bigint' ? pendingDurationData : undefined;

            //get the endtime of the event
            const endTime = eventEndTimesData?.[i]?.status === 'success' ? (eventEndTimesData![i].result as bigint) : undefined;

            /*ACTIVE TICKTES --> tickets that the owner is the user, the ticket state is Active and the endTime is bigger thatn the nowSec */
            const owner = ticktesOfOwnerData?.[i];

            //if the user don't have tickets we should search if he have tickets onSale
            if (owner?.status === 'success' && Array.isArray(owner.result)) {
                //if true, the ticket can be 
                const owned = (owner.result as bigint[]) //all the ticktes that the owner have for the event 
                    .map(id => ({ id, info: ticketInfoMap[`${addr}-${id}`] }))  //create a map with id and info (the TicketInfo)
                    .filter(t => t.info);

                //tickets will be in finished tab if teh stas is redeemed or the event has finsished
                const finishedT = owned.filter(t =>
                    t.info!.status === TicketStatus.Redeemed ||
                    (endTime !== undefined && nowSec > endTime),
                );
                // ticktes active the event isn't redeemes and the event is still active (no need to chck if it's active bc ticktesOfOwnerData only can be active or redeemed )
                const activeT = owned.filter(t =>
                    t.info!.status !== TicketStatus.Redeemed &&
                    !(endTime !== undefined && nowSec > endTime),
                );

                if (activeT.length)
                    active.push({
                        address: addr,
                        endTime: endTime,
                        pendingDuration: pd,
                        eventMetadata: eventMetadataMap[addr],
                        eventMetadataLoading: !eventMetadataMap[addr] && !fetchError,
                        eventMetadataError: !!fetchError,
                        ownedTickets: activeT,
                    });

                if (finishedT.length)
                    finished.push({
                        address: addr,
                        endTime: endTime,
                        pendingDuration: pd,
                        eventMetadata: eventMetadataMap[addr],
                        eventMetadataLoading: !eventMetadataMap[addr] && !fetchError,
                        eventMetadataError: !!fetchError,
                        ownedTickets: finishedT,
                    });
            }

            /*TICKETS ON SALE --> the tickets that are in ticktesOfOwnerOnSaleData, but, the tickets that are on sale and the endtime of the event has expired will be assigned to the finished tab  */
            const sale = ticktesOfOwnerOnSaleData?.[i];

            if (sale?.status === 'success' && Array.isArray(sale.result)) {

                const saleTickets = (sale.result as bigint[]).map(id => {

                    const info = ticketInfoMap[`${addr}-${id}`];
                    return info && info.salePrice > 0n && info.seller === userAddress ? { id, info } : null;

                }).filter((t): t is { id: bigint; info: TicketInfo } => t !== null);

                //separate the active for sale and the expired 
                const saleActiveTickets = saleTickets.filter(
                    () => !(endTime !== undefined && nowSec > endTime)
                );
                const saleExpiredTickets = saleTickets.filter(
                    () => endTime !== undefined && nowSec > endTime
                );


                if (saleActiveTickets.length) {
                    onSale.push({
                        address: addr,
                        endTime,
                        pendingDuration: pd,
                        eventMetadata: eventMetadataMap[addr],
                        eventMetadataLoading: !eventMetadataMap[addr] && !fetchError,
                        eventMetadataError: !!fetchError,
                        ownedTickets: saleActiveTickets,
                    });
                }

                if (saleExpiredTickets.length) {
                    finished.push({
                        address: addr,
                        endTime,
                        pendingDuration: pd,
                        eventMetadata: eventMetadataMap[addr],
                        eventMetadataLoading: !eventMetadataMap[addr] && !fetchError,
                        eventMetadataError: !!fetchError,
                        ownedTickets: saleExpiredTickets,
                    });
                }
            }
        });

        return { activeEvents: active, onSaleEvents: onSale, finishedEvents: finished };
    }, [ticktesOfOwnerData, ticktesOfOwnerOnSaleData, ticketInfoMap, allEvents, pendingDurationData, eventEndTimesData, userAddress, eventMetadataMap]);

    //this is the props for the modal that the user oppened, the only one who knows what ticket has to appear in the modal is eventAccordion and TiCketItem
    // first of all, this is set as a prop to the accordion and the accordion puts this as a prop to the ticketItem, yhen the ticketItem when is clciked, then the 
    const openModal = (d: { eventAddress: `0x${string}`; ticket: TicketData; metadata: TicketMetadata | null; imageUrl: string | undefined; eventEndTime?: bigint; location?: string; }) => {
        const { eventAddress, ticket, metadata, imageUrl, eventEndTime, location } = d;
        setSelected({
            eventAddress,
            tokenID: ticket.id,
            name: metadata?.name || `Ticket #${ticket.id}`,
            description: metadata?.description || 'No description.',
            image: imageUrl || '',
            eventEndTime: eventEndTime ? eventEndTime : 0n,
            location: location ? location : "TBC",
            ticketInfo: ticketInfoMap[`${eventAddress}-${ticket.id}`],
            pendingDurationEvent: typeof pendingDurationData === 'bigint' ? pendingDurationData : BigInt(600)

        });
    };

    useEffect(() => {
        if (!selected) return;
        const key = `${selected.eventAddress}-${selected.tokenID}`;
        const freshInfo = ticketInfoMap[key];
        if (freshInfo && freshInfo !== selected.ticketInfo) {
            setSelected(prev => prev ? { ...prev, ticketInfo: freshInfo } : prev);
        }
    }, [ticketInfoMap, selected]);


    //if something goes wrong then this will jump
    const isLoading = isLoadingEvents || isLoadingPendingDuration || isLoadingTicktesOfOwner || isLoadingTicktesOfOwnerOnSale || isLoadingEventEndTimes || isLoadingEventUris || isLoadingTicketInfos;
    if (isLoading) {
        console.log("loading all the data");
        return null;
    }
    const isError = isErrorEvents || isErrorPendingDuration || isErrorTicktesOfOwner || isErrorTicktesOfOwnerOnSale || isErrorEventEndTimes || isErrorEventUris || isErrorTicketInfos;
    if (isError) {
        console.log("something went wrong :(")
        return null;
    }

    //jys want to view teh EventData[] of the active tab
    const viewEvents = activeTab === 'active' ? activeEvents : activeTab === 'onSale' ? onSaleEvents : finishedEvents;

    return (
        <>
            <PageTitle />
            <div className="my-tickets-container">
                <div className="my-tickets-tabs">
                    <button
                        className={`my-tickets-tab ${activeTab === 'active' ? 'active' : ''}`}
                        onClick={() => setActiveTab('active')}
                    >
                        Active
                    </button>
                    <button
                        className={`my-tickets-tab ${activeTab === 'onSale' ? 'active' : ''}`}
                        onClick={() => setActiveTab('onSale')}
                    >
                        On Sale
                    </button>
                    <button
                        className={`my-tickets-tab ${activeTab === 'finished' ? 'active' : ''}`}
                        onClick={() => setActiveTab('finished')}
                    >
                        Finished
                    </button>
                </div>

                <div className="my-tickets-content">
                    {viewEvents.length === 0 ? (
                        <p className="message info-message">No tickets in {activeTab} category.</p>
                    ) : (
                        viewEvents.map(e => (
                            <EventAccordion key={`${e.address}-${activeTab}`} event={e} onTicketClick={openModal} />
                        ))
                    )}
                </div>
            </div>

            {selected && (
                <TicketDetailModal
                    isOpen={!!selected}
                    onClose={() => setSelected(null)}
                    onStatusChange={async () => {
                        await Promise.all([
                            refetchTicketInfos(),
                            refetchTicktesOfOwner(),
                            refetchTicktesOfOwnerOnSale(),
                        ]);
                    }}
                    selectedTicket={selected}
                />
            )}
        </>
    );


}

export default MyTickets;