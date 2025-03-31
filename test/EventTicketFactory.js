const {ethers} = require("hardhat");
const {expect} = require("chai");

describe("mintTickets testing", function(){ 

    it("create an event", async function(){
        const [addr1, addr2, addr3, addr4] = await ethers.getSigners();

        // params: name, symbol, ticketPrice, maxSupply, baseTokenURI, maxTicketsPerAddress, useTimeLimit, eventEndTime
        const factoryEventTicketContract = await ethers.deployContract("EventTicketFactory");
        const eventAddr = factoryEventTicketContract.connect(addr1).createEvent("Event001","ETKT", ethers.parseEther("0.1"), 4n, "null", 3n, true, 1n);

    })
});