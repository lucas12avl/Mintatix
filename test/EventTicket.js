const {ethers} = require("hardhat");
const {expect} = require("chai");
const {loadFixture} = require("@nomicfoundation/hardhat-toolbox/network-helpers"); //efficient way to save the initial state of the contrcat, making test to begin with the same state



async function deployContractFixture() { // the smart contrcat initial state for all tests

    const [addr1, addr2, addr3, addr4] = await ethers.getSigners();
    // params: name, symbol, ticketPrice, maxSupply, baseTokenURI, maxTicketsPerAddress, useTimeLimit, eventEndTime
    const eventTicketContract = await ethers.deployContract("EventTicket", ["Event001","ETKT", ethers.parseEther("0.1"), 4n, "null", 3n, true, 1n]);
    return {eventTicketContract, addr1, addr2, addr3, addr4};
}





describe("mintTickets testing", function(){ 

    it("addr1 wants to buy more ticktes than the maxTicketsPerAddress", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployContractFixture);
        await expect(eventTicketContract.connect(addr1).mintTickets(4n, { value: ethers.parseEther("0.4") }))
        .to.be.revertedWith("limit of owned tickeds reached");
    })


    it("addr1 purchase 2 tickets with more founds than expected", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployContractFixture);

        await expect(eventTicketContract.connect(addr1).mintTickets(2, { value: ethers.parseEther("0.4") })) 
        .to.emit(eventTicketContract, "RefundIssued").withArgs(addr1.address, ethers.parseEther("0.2"));  //listening the emit
        
        expect(await eventTicketContract.totalSupply()).to.equal(2);
        expect(await eventTicketContract.balanceOf(addr1.address)).to.equal(2);
    })

    it("addr1 forget to put founds in the tx", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployContractFixture);

        await expect(eventTicketContract.connect(addr1).mintTickets(2n, { value: ethers.parseEther("0.0") }))
        .to.be.revertedWith("insuficient founds");
        
    })

    it("should revert mintTickets if the event has finished", async function() {

        const {eventTicketContract, addr1} = await loadFixture(deployContractFixture);

        await network.provider.send("evm_increaseTime", [3601]); //increment the time by 1hour and 1 sec to see what happens
        await network.provider.send("evm_mine"); // mine 1 block to apply the new timestamp --> it's not neeeded bc hardhat mines a block when you change the timestamp, but, in order to be more consistent, I prefer mining a block
    
        //mint a ticket expecting revert bc time limit 
        await expect(eventTicketContract.connect(addr1).mintTickets(1, { value: ethers.parseEther("0.1") }))
        .to.be.revertedWith("the event has finished");
    });

})

