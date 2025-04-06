const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const {ethers} = require("hardhat");

module.exports = buildModule("Mintatix", (m) => {
  
  const factory = m.contract("EventTicketFactory"); //deploy the factory

  const eventTickets = [];
  const numProxies = 2; //how many evenets we want to create


  /* EVENT WITH TIME LIMIT,  --> event that is already finished */
  // params: name, symbol, ticketPrice, maxSupply, baseTokenURI, maxTicketsPerAddress, useTimeLimit, eventEndTime
  const createEventTx = m.call(factory, "createEvent",["Event000", "ETKT", ethers.parseEther("0.1"), 4n, "null", 3n, true, 0n], { id: "createEvent_Event000" });
  
  const eventAddress = m.readEventArgument(createEventTx, "EventCreated", "eventAddress", {id: "readEvent_Event000"}); //capture the event emmited by the facotry and take the eventAddress variable

  //in order to get the contrcat instance, we have to associate the address with an ABI 
  //the ABI provides the interface of the contract, so we can call the functions
  //this is bc minimal proxy contracts don't have a fixed ABI,  so we have to provide it. Here we are using the EventTicketLogic contract ABI
  const eventTicket = m.contractAt("EventTicketLogic", eventAddress, {id: "proxy_Event000"});
  eventTickets.push(eventTicket); //push the event to the array of events 


  for (let i = 1; i < numProxies+1; i++) { //create from Event001 

    const eventName = "Event00"+i
    const eventSymbol = "ETKT"+i

    const createEventTx = m.call(factory, "createEvent",[eventName, eventSymbol, ethers.parseEther("0.1"), 4n, "null", 3n, false, 1n], {id: "createEvent_" + eventName});

    const eventAddress = m.readEventArgument(createEventTx, "EventCreated", "eventAddress", {id: "readEvent_"+ eventName})
    const eventTicket = m.contractAt("EventTicketLogic", eventAddress, {id: "proxy_"+ eventName});
    eventTickets.push(eventTicket); 
  }



  return {factory, eventTickets}; //the factory and the event proxy contract

});
