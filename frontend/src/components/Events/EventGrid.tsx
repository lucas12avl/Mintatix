import { useMemo } from 'react'
import { useReadContract, useReadContracts } from 'wagmi';
import type { Abi } from 'abitype';
//abis
import factoryContract from '../../contracts/EventTicketFactory.json';
import eventLogicContract from '../../contracts/EventTicketLogic.json';
//address
import factoryAddr from '../../contracts/FactoryAddress.json';
//custom hooks
import FirstEventCard from './FirstEventCard';
import EventCard from './EventCard';
import PageTitle from '../PageTitle';


const EventGrid = () => {

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

            console.log(allEventsData as `0x${string}`[])
            return allEventsData as `0x${string}`[];

        }
        return [];

    }, [allEventsData]);

    //if we have the address --> prepare to reed evnetEndTime of all indivual events
    const eventEndTimeContracts = useMemo(() => {

        return allEvents.map((eventAddress) => ({

            address: eventAddress,
            abi: eventLogicContract.abi as Abi, //here wen need to put the abi type, bc the wagmi hook that reads multiple contracts at once needs that this object the abi has to be Abi type (read doc)
            functionName: 'eventEndTime',

        }));

    }, [allEvents])

    //read all he contracts at the same time 
    // endTimeData is an onject like --> {result: 1763676000n, status: 'success'}
    const { data: endTimeData, isLoading: isLoadingEndTime, isError: isErrorEndTime } = useReadContracts({
        contracts: eventEndTimeContracts,
        query: { enabled: !isLoadingEvents && allEvents.length > 0 } //only reads the contract when this comes true 
    })

    //we have all the endTimes, we only want to show the active events (eventEndTime > now)
    const activeEvents = useMemo(() => {
        //only can be calculated if we get the endTimes from the previous reaf
        if (endTimeData && !isLoadingEndTime && Array.isArray(endTimeData)) {

            const currentTimeSeconds = BigInt(Math.floor(Date.now() / 1000)); //the unix time like we got in teh smart contract event read

            const addresses: `0x${string}`[] = [];
            const endTimes: bigint[] = [];

            endTimeData.forEach((result, index) => {

                const active = result as { result?: bigint; status: 'success' | 'failure'; }

                if (active.status === 'success' && active.result !== null && active.result !== undefined) {

                    if (active.result > currentTimeSeconds) {
                        addresses.push(allEvents[index]);
                        endTimes.push(active.result);
                    }
                }

            });

            return { addresses, endTimes };

        }
        return { addresses: [], endTimes: [] };
    }, [allEvents, endTimeData, isLoadingEndTime]) //if one of these changes, the useMemo will recompute the ActiveEvents

    const isLoading = isLoadingEvents || isLoadingEndTime;
    const isError = isErrorEvents || isErrorEndTime;

    if (isLoading) return <p>Loading Active Events...</p>
    if (isError) return <p className='message error-message'>Error: Something went wrong loading the active events </p>;

    return (
        <>
            <PageTitle />
            <div className="event-grid">
                {activeEvents.addresses.length === 0 && (
                    <p>There are no active events at this time</p>
                )}

                {activeEvents.addresses.length > 0 && (
                    <div className="first-event-card-wrapper">
                        <FirstEventCard
                            eventAddress={activeEvents.addresses[0]}
                            eventEndTime={activeEvents.endTimes[0]}
                        />
                    </div>
                )}
                {activeEvents.addresses.slice(1).map((addr, i) => (
                    <EventCard key={addr} eventAddress={addr} eventEndTime={activeEvents.endTimes[i + 1]} /> // +1 because we already used the first one in the FirstEventCard component

                ))}

            </div>
        </>
    );

}

export default EventGrid;