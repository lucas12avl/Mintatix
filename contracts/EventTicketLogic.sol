// SPDX-License-Identifier: MIT 

pragma solidity ^0.8.28;

import "node_modules/erc721a-upgradeable/contracts/extensions/ERC721AQueryableUpgradeable.sol";
import "node_modules/@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "node_modules/@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "node_modules/@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract EventTicketLogic is Initializable, ERC721AQueryableUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable{

    //this library can make a dynaic array of uints256, ideal to store the tickes thta the user have on sale bc 
    //he is not the owner of them, and it's unefficnet check all the ticktes that the smart contract owns 
    using EnumerableSet for EnumerableSet.UintSet; 

    /************************************
    *         GLOBAL VARIABLES          *
    ************************************/
    enum TicketStatus { Active, Pending, Redeemed } //the states of a ticket
    mapping(address => EnumerableSet.UintSet) private _ticketsForSaleByUser; //mapping of the tickets that a user has on sale --> the smart contract is the owner of them
    
    struct Ticket {
        TicketStatus status; //the state of the ticket
        uint256 pendingSince; //to know if the pending state has finished (in case the usr has not redeemed the ticket)
        uint256 salePrice; //if a usr resell a ticket, the price will be here
        address seller;   //to remember the user who sells the ticket, bc when someone pays, the smart contract will make the transaction automatically
        bytes32 commitHash; //hash that will nclude the tockenID + secretNonce, this is bc before, any user who wants to redeem a ticket taht not belongs to him only have to know when the user put the ticket on sale, and the tokenID.
    } // we doesnt need to put the adress owner bc ERC721A controlls this part of the ERC721 standard 
    
    struct EventConfig {
        string name;
        string symbol;
        uint256 ticketPrice;
        uint256 maxSupply;
        string eventURI; 
        string baseTokenURI;
        uint256 maxTicketsPerAddress;
        uint256 startPurchaseTime;
        uint256 eventEndTime;
    }

    uint256 public ticketPrice;
    uint256 public maxSupply;
    string public eventURI; //new URI for the event, pints to a json that includes the event description, the cid of the image...
    string private baseTokenURI;
    uint256 public maxTicketsPerAddress; //the user cannot have had more than those tickets (even if they sold them and no longer own them)

    //time limit (in hours) for making transactions (mint, buy, resell...)
    //the organizer must set the time in UNIX format
    uint256 public startPurchaseTime;   //indicates when people can start to buy and mint tickets --> you can buy ticktes until the event ends
    uint256 public eventEndTime;    // indicates when the event finishes, from the deplyment of the contract until the event closes  
                   

    uint256 public constant pendingDuration = 600; //you have 10 minutes to redeem the pending ticket
    mapping(address => uint256) public ticketsPurchased; // mapping of how many tickets a user have bought
 

    mapping(address => bool) public validators; //mapping for validators 

    mapping(uint256 => Ticket) public tickets; // all the minted tickets in one place
  


    /************************************
    *              EVENTS               *
    ************************************/
    event TicketsMinted(address indexed user, uint256 quantity);
    event RefundIssued(address indexed user, uint256 refund); //notify how much the contract has refound to the user
    event PendingSuccess(uint256 indexed tokenID, uint256 timestamp, bytes32 commitHash); //the dapp will see how much time the user have to redeem --> qr + countdown
    event RedeemedSuccess(uint256 indexed tokenID, address validator);
    event TicketForSale(uint256 indexed tokenID, uint256 salePrice);
    event TicketCancelledForSale(uint256 indexed tokenID, address ticketOwner);
    event TicketSold(uint256 indexed tokenID,  uint256 salePrice, address seller, address buyer);


    /************************************
    *           CUSTOM ERRORS           *
    ************************************/
    error EventEndBeforeNow();
    error EventEnded();
    error NotStartedYet();
    error InsufficientFunds();
    error MaxSupplyExceeded();
    error TicketLimitReached();
    error NotTicketOwner();
    error TicketNotActive();
    error TicketNotPending();
    error PendingNotOver();
    error RedeemExpired();
    error PriceTooHigh();
    error TicketNotForSale();
    error NoSelfBuy();
    error TokenDoesNotExist();
    error CancelSaleRequired();
    error NotAValidator();
    error InvalidCommit();

    constructor(){
        _disableInitializers(); //the constructor is only called once, so, the clones will have disab
    }


    /************************************
    *           INITIALIZER             *
    ************************************/
     function initialize( EventConfig memory config, address _owner)  initializerERC721A external initializer {

        //imports
        __ERC721AQueryable_init();
        __ERC721A_init(config.name, config.symbol);
        __Ownable_init(_owner); // if we put the msg.sender as the owner, then the owner will be the addr of the fabric, not the user behind the fabric.
        __ReentrancyGuard_init();

        //global variables of each clone
        ticketPrice = config.ticketPrice;
        maxSupply = config.maxSupply;
        eventURI = config.eventURI;
        baseTokenURI = config.baseTokenURI;
        maxTicketsPerAddress = config.maxTicketsPerAddress;


        
        startPurchaseTime = config.startPurchaseTime; // its needent to chck if the purchase time is in the past, bc bc the event will be cretaed after the deploy of the event contract


        if(config.eventEndTime < block.timestamp) revert EventEndBeforeNow(); //the event can't finish before the deployment of the contract
        eventEndTime = config.eventEndTime;
    
        validators[_owner] = true;

    }

    /************************************
    *         REQUIRE & MODIFIER        *
    ************************************/
    function _checkActiveEvent() internal view {
        if (block.timestamp >= eventEndTime) revert EventEnded();
        if (block.timestamp < startPurchaseTime) revert NotStartedYet();
    }
    modifier onlyValidator() {
        if (!validators[msg.sender]) revert NotAValidator(); //the validator has to be in the mapping of validators
        _;
    }


    /************************************
    *           USER FUNCTIONS          *
    ************************************/

    /****** allows to users create tickets (if the usr doens't owned more ticktes than the limit) ******/ 
    function mintTickets(uint256 quantity) external payable nonReentrant{

        _checkActiveEvent();
        

        uint256 totalPrice = ticketPrice * quantity;
        if (msg.value < totalPrice) revert InsufficientFunds();//lets check if the user put in the transaction the amount to purchase the ticket
        if (totalSupply() + quantity > maxSupply) revert MaxSupplyExceeded();//lets check if we dont exceed the max tickets supply 
        if (ticketsPurchased[msg.sender] + quantity > maxTicketsPerAddress) revert TicketLimitReached();//the user can't own more than X ticktes (historically)
        
        //OK
        ticketsPurchased[msg.sender] += quantity;
        uint256 startTokenID = totalSupply(); //if the usr bought more than 1 ticket, we need too store all the infromation about 
        _safeMint(msg.sender, quantity);
        
        for(uint256 i =0; i < quantity; i++){ // put the default params of the ticket
            uint256 tokenID = startTokenID + i;
            tickets[tokenID] = Ticket({
                status: TicketStatus.Active,
                pendingSince: 0,
                salePrice: 0,
                seller: address(0),
                commitHash: bytes32(0)
            });
        }
        emit TicketsMinted(msg.sender, quantity);

        //return the remaining amount
        if(msg.value > totalPrice){
            uint256 refound = msg.value - totalPrice;
            payable(msg.sender).transfer(refound);
            emit RefundIssued(msg.sender, refound); // notify the user

        }
        
    }

    //sets the state of the ticket to pendign, this permits the user to redeem the ticket with a validator (the dapp will generate a QR that the validator will scan )
    function setPendingToTKT(uint256 tokenID, bytes32 commitHash) external {

        _checkActiveEvent();
        if (ownerOf(tokenID) != msg.sender) revert NotTicketOwner();
        if(commitHash == bytes32(0)) revert InvalidCommit();

        //two possibilities to put in pending a ticket:

        //when the ticket is in pendign but the time to redeem it has expired
        if (tickets[tokenID].status == TicketStatus.Pending){ 
            if(block.timestamp <= tickets[tokenID].pendingSince + pendingDuration) revert PendingNotOver();
        }
        else{ //when the ticket is in active state
            if(tickets[tokenID].status != TicketStatus.Active) revert TicketNotActive();
            tickets[tokenID].status = TicketStatus.Pending;
        }

        tickets[tokenID].commitHash = commitHash;
        tickets[tokenID].pendingSince = block.timestamp;
        emit PendingSuccess(tokenID, block.timestamp, commitHash);
    }

    //sets a ticket with pending state to 
    function setRedeemedToTKT(uint256 tokenID, bytes32 secretNonce) external onlyValidator { //only validators can redeem a pending ticket to ensure the usr enters the event [the validator can be an automatic machine]

        _checkActiveEvent();

        if (tickets[tokenID].status != TicketStatus.Pending) revert TicketNotPending();

        //cant redeem if the timelimit exceeds the timestamp
        if (block.timestamp >= tickets[tokenID].pendingSince + pendingDuration) revert RedeemExpired();

        //commit reveal
        bytes32 expected = keccak256(abi.encodePacked(tokenID, secretNonce));
        if(expected != tickets[tokenID].commitHash) revert InvalidCommit();
        tickets[tokenID].commitHash = bytes32(0); //the ticket can't be redeemed again 


        tickets[tokenID].status = TicketStatus.Redeemed;
        emit RedeemedSuccess(tokenID, msg.sender); //msg.sender bc if a validator is a human and has a bad behaviour, we can identify them, or if a machine didnt redeem as much as others we can check if something its wrong.

    }

    function addTicketsForSale(uint256 tokenID, uint256 price ) external {

        _checkActiveEvent();
        if (!_exists(tokenID)) revert TokenDoesNotExist();
            
        // operation with 0.3 it's incorrect bc is an integer!!!
        if (price > (ticketPrice * 130) / 100) revert PriceTooHigh();

        
        if(_ticketsForSaleByUser[msg.sender].contains(tokenID)){ // if the ticket is on sale, then the seller wants to change the price 

            tickets[tokenID].salePrice = price;
   
        }
        else{
            if (ownerOf(tokenID) != msg.sender) revert NotTicketOwner();
            _checkPendingStateIsFinished(tokenID); //the usr can't put to sell a ticket that is still in pending state (when the pending time has not finished)
            if (tickets[tokenID].status != TicketStatus.Active) revert TicketNotActive(); // in this case, ensures that is not Redeemed
        
            tickets[tokenID].seller = msg.sender;
            tickets[tokenID].salePrice = price;
            _ticketsForSaleByUser[msg.sender].add(tokenID);

            // now, the ticketNFT will belong to the smart contract, thats because if someone pays the price,
            // the smart contrcat will transfer the amount to the seller, and the ticket to the buyer

            safeTransferFrom(msg.sender, address(this), tokenID); //ERC721AUpgradeable 
            
        }
        emit TicketForSale(tokenID, price);

    }

    function cancelTicketForSale(uint256 tokenID) external{
        
        // you can also cancel the sale if the event has finished in order to get back your ticket 
        //it's needed to check that is the seller who wants to get back his ticket from the smart contract
  
        if(!_ticketsForSaleByUser[msg.sender].contains(tokenID)) revert CancelSaleRequired(); //the ticket is not on sale

        tickets[tokenID].seller = address(0);
        tickets[tokenID].salePrice = 0;
        _ticketsForSaleByUser[msg.sender].remove(tokenID);

        // until now, the contract is the owner, thats bc the "this." is nedeed inn order to make the transfer 
        // in the name of the smart contract (teh actual owner)
        // if it's called without "this." the msg.sender will be the user, and if the token is on sale, it not belongs to him
        this.safeTransferFrom(address(this), msg.sender, tokenID); //msg.sender is the seller bc it's a requirement in the top of the function
        emit TicketCancelledForSale(tokenID, msg.sender);
        

    }

    function buyTicket(uint256 tokenID) external payable nonReentrant{

        _checkActiveEvent();

        if (tickets[tokenID].seller == msg.sender) revert NoSelfBuy();
        if (tickets[tokenID].seller == address(0)) revert TicketNotForSale();
        if (ticketsPurchased[msg.sender] + 1 > maxTicketsPerAddress) revert TicketLimitReached();
        if (msg.value < tickets[tokenID].salePrice) revert InsufficientFunds();

        uint256 salePrice = tickets[tokenID].salePrice;
        address seller = tickets[tokenID].seller;

        ticketsPurchased[msg.sender] += 1;
        tickets[tokenID].salePrice = 0;
        tickets[tokenID].seller = address(0);
        _ticketsForSaleByUser[seller].remove(tokenID);
        this.safeTransferFrom(address(this), msg.sender, tokenID);
        payable(seller).transfer(salePrice);

        //return the remaining amount
        if(msg.value > salePrice){
            uint256 refound = msg.value - salePrice;
            payable(msg.sender).transfer(refound);
            emit RefundIssued(msg.sender, refound); // notify the user

        }

        emit TicketSold(tokenID, salePrice, seller, msg.sender);
        
    }

    function ticketsForSaleOfUsr(address user) external view returns (uint256[] memory) {
        return _ticketsForSaleByUser[user].values();
    }

    function tokenURI(uint256 tokenID) public view override(ERC721AUpgradeable, IERC721AUpgradeable) returns (string memory) {

        if (!_exists(tokenID)) revert TokenDoesNotExist();
        return string(abi.encodePacked(baseTokenURI)); //_toString(uint256 value) //from erc721A
    }


    /************************************
    *              INTERNAL             *
    ************************************/

    //smart contracts can't make time events for do smthg. When the user wants to do smthg after put the pending state
    // (and the pending time finishes), we have to change the state automatically before doing the requested action.
    function _checkPendingStateIsFinished(uint256 tokenID) internal {

        if(tickets[tokenID].status == TicketStatus.Pending){
            if(tickets[tokenID].pendingSince + pendingDuration < block.timestamp){  //check if the pendign time has finished

                tickets[tokenID].status = TicketStatus.Active; //reset the state 
                tickets[tokenID].pendingSince = 0; //reset the pending time
                tickets[tokenID].commitHash = bytes32(0); //reset the commit hash
            
            }
            else{ //if the ticket is still pending, 
                revert PendingNotOver();
            }
        }
        //if the ticket is not pendign, we can continue 

    }
    

    /************************************
    *           ONLY OWNER              *
    ************************************/

    function withdraw() external onlyOwner nonReentrant{

        payable(owner()).transfer(address(this).balance);
    }

    //if it's needeed to reestablish the base tokenURI
    function setBaseURI(string memory _baseTokenURI) external onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    /*     ROLE MANAGEMENT      */
    function addValidator(address newValidator) external onlyOwner {
        validators[newValidator] = true;
    }

    function removeValidator(address validator) external onlyOwner{
         validators[validator] = false;
    }


    /************************************
    *             OVERRIDE              *
    ************************************/

    /****** overrides ERC721AUpgradeable, and IERC721AUpgradeable to follow ERC165******/
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721AUpgradeable, IERC721AUpgradeable) returns (bool) {
        return ERC721AUpgradeable.supportsInterface(interfaceId);
    }

    //in order to let the smart contract NFTs, it has to implement the ERC721Receiver to ensure it knows how to properly manipulate NFTs and the recived NFT won't be blocked there
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }


    // in order to protect users, any pending tciket or ticket on sale can't be transfered, including the standard transfers with ERC721
    function _beforeTokenTransfers(address from, address to, uint256 tokenID, uint256 quantity) internal override { // this will execute when mint, transferFrom
        
        if (from != address(0) && quantity == 1) { //if it's not minting a new ticket
            _checkPendingStateIsFinished(tokenID);
            
            if(tickets[tokenID].seller != address(0)){ //if the ticket is on sale, transfers are resticted only to put 
                    
                //when we arrive here, the addTicketForSale() puts the info of the seller and the price in the tikcet, before making the trsnfer
                // thats bc it's needed to look if the transfer that is going to make is to put the contract as owner of the ticket 
                //(The ticket is in the process of being put on sale)
                //the case wehn the user whants to put his ticket on sale 
                //if the request is from the smart contract and to is the seller
                //the user is trying to get back his ticket that is on sale, and the actual owner (the smart contract) has to auhorize the transfer
                //If the ticket is for sale or is being put up for sale, we cannot transfer it to another person with TransferFrom
                if (!((from == tickets[tokenID].seller && to == address(this)) || (from == address(this) && to == tickets[tokenID].seller))) revert CancelSaleRequired();
                //this revert is just in case a user finds a way to do the transfer, but, the owner of the token is the smart contract when the token is for sale
                // so the real owner (the seller) can't transfer his token bc it not belongs to him (while it's for sale) 
                
            }
             if (block.timestamp < eventEndTime && from != address(this) && to != address(this)){
                if (ticketsPurchased[to] + 1 > maxTicketsPerAddress) revert TicketLimitReached();
                ticketsPurchased[to] += 1;
            }
        }

    }
    
}