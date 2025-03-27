const {ethers} = require("hardhat");
const {expect} = require("chai");
const {loadFixture} = require("@nomicfoundation/hardhat-toolbox/network-helpers"); //efficient way to save the initial state of the contrcat, making test to begin with the same state


async function deployContractFixture() { // the smart contrcat initial state for all tests

    const [addr1, addr2, addr3, addr4] = await ethers.getSigners();
    // params: name, symbol, ticketPrice, maxSupply, baseTokenURI, maxTicketsPerAddress, useTimeLimit, eventEndTime


    const eventTicketContract = await ethers.deployContract("EventTicket", ["Event001","ETKT", ethers.parseEther("0.1"), 4n, "null", 3n, true, 1n]);
    return {eventTicketContract, addr1, addr2, addr3, addr4};
}

async function deployWithMintedTktFixture() { //fixture that depploy the contract and mint 3 ticktes for addr1 and 1 ticket for addr2

    const {eventTicketContract, addr1, addr2, addr3, addr4} = await loadFixture(deployContractFixture);
    await eventTicketContract.connect(addr1).mintTickets(2, { value: ethers.parseEther("0.2")}); //addr1 buys 2 tickets
    await eventTicketContract.connect(addr2).mintTickets(1, { value: ethers.parseEther("0.1")}); //addr2 buys 1 ticket

    await eventTicketContract.connect(addr1).addValidator(addr3) //the addr3 is a validator
    return {eventTicketContract, addr1, addr2, addr3, addr4};
}

async function deployWithTicketOnSaleFixture(){
    const {eventTicketContract, addr1, addr2, addr3, addr4} = await loadFixture(deployWithMintedTktFixture);
    //addr1 puts for sale his ticket ID:0
    await eventTicketContract.connect(addr1).addTicketsForSale(0n, 100000000000000000n); //0.1 eth
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

describe("add/remove a validator ", function(){

    it("add addr2 as validator, redeem a ticket, remove as validator an tries to redeem another ticket", async function(){
        const {eventTicketContract, addr1, addr2, addr3} = await loadFixture(deployContractFixture);

        await eventTicketContract.connect(addr1).addValidator(addr3);
        await eventTicketContract.connect(addr1).mintTickets(2, { value: ethers.parseEther("0.2")});

        await eventTicketContract.connect(addr1).setPendingToTKT(0n);
        await eventTicketContract.connect(addr3).setRedeemedToTKT(0n);

        await eventTicketContract.connect(addr1).removeValidator(addr3);
        await eventTicketContract.connect(addr1).setPendingToTKT(1n);

        await expect (eventTicketContract.connect(addr3).setRedeemedToTKT(1n))
        .to.be.revertedWithCustomError(eventTicketContract, "AccessControlUnauthorizedAccount")

        

    })
})

describe("set the ticket to Pending --> setPendingToTKT()", function(){
   
    it("addr1 changes the state of the ticket to 'Pending' succesfully", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployWithMintedTktFixture);

       await eventTicketContract.connect(addr1).setPendingToTKT(0n);
       const ticket = await eventTicketContract.tickets(0n); //take the ticket
       expect(ticket.status).to.equal(1); //then ".status"

    }),

    it("addr1 redeem his ticket 0 and tries to put the Pending again", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployWithMintedTktFixture);
        
        await eventTicketContract.connect(addr1).setPendingToTKT(0n);

        //OBS: don't need to add the validator to redeem because addr1 is the OWNER, and the owner have all the roles implicity
        await eventTicketContract.connect(addr1).setRedeemedToTKT(0n);
        const ticket = await eventTicketContract.tickets(0n);
        expect(ticket.status).to.equal(2) //check if succesfully redeemed


        await expect(eventTicketContract.connect(addr1).setPendingToTKT(0n))
        .to.be.revertedWith("only Active tickets can be changed to Pending");
           


    }),

    it("addr1 tries to us the pendign function in a ticket that his not the owner", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployWithMintedTktFixture);

        await expect (eventTicketContract.connect(addr1).setPendingToTKT(2n))
        .to.be.revertedWith("you are not the owner of this ticket");


    }),

    it("addr1 tries tu put the pending function to a ticket that is on sale", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployWithMintedTktFixture);
        await eventTicketContract.connect(addr1).addTicketsForSale(0n, 100000000000000000n); //0,1 ethers
        await expect (eventTicketContract.connect(addr1).setPendingToTKT(2n))
        .to.be.revertedWith("you are not the owner of this ticket");

    });

    it("addr1 tries to put in pending a ticket when the EVENT has finalized", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployWithMintedTktFixture);

        await network.provider.send("evm_increaseTime", [3601]);
        await network.provider.send("evm_mine");

        await expect(eventTicketContract.connect(addr1).setPendingToTKT(0n))
        .to.be.revertedWith("the event has finished");

    })

    it("addr1 tries to put in pending a ticket when the PENDING TIME has finished", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployWithMintedTktFixture);

        
        await eventTicketContract.connect(addr1).setPendingToTKT(0n);
        const ticketBefore = await eventTicketContract.tickets(0n);
        const timeSinceBefore = ticketBefore.pendingSince;

        await network.provider.send("evm_increaseTime", [660]); //the 10 minutes expires, so, if we call to pending it will renew the pendingSince
        await network.provider.send("evm_mine");

        await eventTicketContract.connect(addr1).setPendingToTKT(0n);
        const ticketAfter = await eventTicketContract.tickets(0n);
        const timeSinceAfter = ticketAfter.pendingSince;
        
        await expect(timeSinceAfter).greaterThan(timeSinceBefore); //the time must be changed
        await expect(ticketAfter.status).to.equal(1); // the tocket has the pending state


    })

})





describe("set the ticket to redeemed --> setRedeemedToTKT()", function(){

    it("addr2 redeems his ticket ID: 2 succesfully", async function(){
        const {eventTicketContract, addr1, addr2, addr3} = await loadFixture(deployWithMintedTktFixture);
        await eventTicketContract.connect(addr2).setPendingToTKT(2n);

        await eventTicketContract.connect(addr3).setRedeemedToTKT(2n); //the validator redeems the pending ticket

        const ticket = await eventTicketContract.tickets(2n);
        expect(ticket.status).to.equal(2) //check if succesfully redeemed

    })

    it("addr2 wants to redeem his tikcet ID:2 itself (he's not a validator)", async function(){

        const {eventTicketContract, addr1, addr2} = await loadFixture(deployWithMintedTktFixture);
        await eventTicketContract.connect(addr2).setPendingToTKT(2n);
        
        //the user tries to redeem his own ticket
        await expect (eventTicketContract.connect(addr2).setRedeemedToTKT(2n)) 
        .to.be.revertedWithCustomError(eventTicketContract, "AccessControlUnauthorizedAccount") //error from the AccesControl.sol import 

    })

    it("addr2 tries to redeem (with a validator) a ticket when the EVENT has finished", async function(){
        const {eventTicketContract, addr1, addr2, addr3} = await loadFixture(deployWithMintedTktFixture);
        await network.provider.send("evm_increaseTime", [3500]);
        await network.provider.send("evm_mine");

        await eventTicketContract.connect(addr2).setPendingToTKT(2n);
        await network.provider.send("evm_increaseTime", [300]);
        await network.provider.send("evm_mine");

        await expect(eventTicketContract.connect(addr3).setRedeemedToTKT(2n)).to.be.revertedWith("the event has finished")

    })

    it("addr3 tries to redeem the ticket of addr2 that is not in the Pending state", async function(){
        const {eventTicketContract, addr1, addr2, addr3} = await loadFixture(deployWithMintedTktFixture);
        await expect(eventTicketContract.connect(addr3).setRedeemedToTKT(2n)).to.be.revertedWith("only Pending tickets can be redeemed")

    })

    it("addr2 tries to redeem his ticket ID:2 when the PENDING TIME of the ticket has finished", async function(){
        const {eventTicketContract, addr1, addr2, addr3} = await loadFixture(deployWithMintedTktFixture);
        await eventTicketContract.connect(addr2).setPendingToTKT(2n);
        await network.provider.send("evm_increaseTime", [650]); //the pending time is 600 (10 minutes)
        await network.provider.send("evm_mine");

        await expect(eventTicketContract.connect(addr3).setRedeemedToTKT(2n)).to.be.revertedWith("the time to redeem the ticket has expired, re activate the pending status")

    })

})


describe("tries to list for sell a ticket --> addTicketsForSale()",function(){
    //in this test also check if a ticket it's on pending time --> _checkPendingStateIsFinished() [internal]

    it("addr1 puts on sale his ticket ID:0 successfully", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployWithMintedTktFixture);
        await eventTicketContract.connect(addr1).addTicketsForSale(0n, 100000000000000000n); //0,1 ethers
        const ticket0 = await eventTicketContract.tickets(0n);

        expect(ticket0.salePrice).to.equal(100000000000000000n);
        expect(ticket0.seller).to.equal(addr1.address);
        expect(ticket0.status).to.equal(0);


    })

    it("addr1 puts in pending his ticket ID:0 and tries to sell the ticket", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployWithMintedTktFixture);

        await eventTicketContract.connect(addr1).setPendingToTKT(0n);

        await expect(eventTicketContract.connect(addr1).addTicketsForSale(0n, 100000000000000000n))
        .to.be.revertedWith("your ticket is still pending. Please wait until you take any further action");
        
    })

    it("addr1 tries to put on sale his ticket ID:0 when the ticket it's redeemed", async function(){

        
        const {eventTicketContract, addr1, addr2, addr3} = await loadFixture(deployWithMintedTktFixture);

        await eventTicketContract.connect(addr1).setPendingToTKT(0n);
        await eventTicketContract.connect(addr3).setRedeemedToTKT(0n);

        await expect(eventTicketContract.connect(addr1).addTicketsForSale(0n, 100000000000000000n)) //0,1 eth
        .to.be.revertedWith("only Active tickets can be sold");


        
    })

    it("addr1 tries to sell a ticket when the event has finished", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployWithMintedTktFixture);
        
        await network.provider.send("evm_increaseTime", [3605]); //the event has finished
        await network.provider.send("evm_mine");

        await expect(eventTicketContract.connect(addr1).addTicketsForSale(0n, 100000000000000000n)) //0,1 eth
        .to.be.revertedWith("the event has finished");

        
    })

    it("addr1 tries to sell a ticket that not belongs to him", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployWithMintedTktFixture);
        
        await expect(eventTicketContract.connect(addr1).addTicketsForSale(2n, 100000000000000000n)) //tries to sell the ticket of addr2
        .to.be.revertedWith("you are not the owner of this ticket");
        
    })

    
    it("addr1 tries to sell his ticket ID:0 with a price bigger than 130% of the original price", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployWithMintedTktFixture);

        await expect(eventTicketContract.connect(addr1).addTicketsForSale(0n, 200000000000000000n))//0,1 ethers
        .to.be.revertedWith("the ticket cannot be sold for more than 30% above the original price");

    })
})

describe("tries to cancel a sell --> cancelTicketForSale()", function(){
    
    it("addr1 cancel the sale of his ticket with ID:0 successfully", async function(){
        const {eventTicketContract, addr1} = await loadFixture(deployWithTicketOnSaleFixture);
        await eventTicketContract.connect(addr1).cancelTicketForSale(0n);
        const ticket0 = await eventTicketContract.tickets(0n);

        expect(ticket0.seller).to.equal("0x0000000000000000000000000000000000000000");
        expect(ticket0.salePrice).to.equal(0);
        
    })

    it("addr1 tries to cancel the sale of a ticket that is not the seller", async function(){

        const {eventTicketContract, addr1, addr2, addr3} = await loadFixture(deployWithTicketOnSaleFixture);
        await eventTicketContract.connect(addr2).addTicketsForSale(2n, 100000000000000000n); //addr2 puts his ticket for sale

        await expect(eventTicketContract.connect(addr1).cancelTicketForSale(2n)) //addr1 tries to cncell the sale of addr2
        .to.be.revertedWith("you are not the owner of this ticket");


    })

    it("addr1 attempts to cancel the sale of a ticket that is not being sold", async function(){

        const {eventTicketContract, addr1} = await loadFixture(deployWithTicketOnSaleFixture);

        await expect(eventTicketContract.connect(addr1).cancelTicketForSale(1n)) //addr1 tries to cncell the sale of addr2
        .to.be.revertedWith("the ticket is not for sale");

    })

})

