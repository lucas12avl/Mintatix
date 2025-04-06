// SPDX-License-Identifier: MIT 

pragma solidity ^0.8.28;

import "node_modules/erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import "node_modules/@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "node_modules/@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "node_modules/@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "node_modules/@openzeppelin/contracts/utils/Strings.sol";

contract EventTicketLogic is Initializable, ERC721AUpgradeable, OwnableUpgradeable, AccessControlUpgradeable, ReentrancyGuardUpgradeable{


    /************************************
    *         GLOBAL VARIABLES          *
    ************************************/
    enum TicketStatus { Active, Pending, Redeemed } //the states of a ticket
    
    struct Ticket {
        TicketStatus status; //the state of the ticket
        uint256 pendingSince; //to know if the pending state has finished (in case the usr has not redeemed the ticket)
        uint256 salePrice; //if a usr resell a ticket, the price will be here
        address seller;   //to remember the user who sells the ticket, bc when someone pays, the smart contract will make the transaction automatically
    } // we doesnt need to put the adress owner bc ERC721A controlls this part of the ERC721 standard 

    uint256 public ticketPrice;
    uint256 public maxSupply;
    string private baseTokenURI;
    uint256 public maxTicketsPerAddress; //Historically, the user cannot have had more than those tickets (even if they sold them and no longer own them)

    //time limit (in hours) for making transactions (mint, buy, resell...)
    bool public useTimeLimit;       //if it's true, the timestap will take effect
    uint256 public eventEndTime;    // indicates when the event finishes, from the deplyment of the contract until the event closes  
   

    uint256 public pendingDuration; 
     mapping(address => uint256) public ticketsPurchased; // mapping of how many tickets a user have bought
 
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE"); // if allowSelfCheckIn is false, only addresses with this role can redeem

    mapping(uint256 => Ticket) public tickets; // all the minted tickets in one place
  


    /************************************
    *              EVENTS               *
    ************************************/
    event TicketsMinted(address indexed user, uint256 quantity);
    event RefundIssued(address indexed user, uint256 refund); //notify how much the contract has refound to the user
    event PendingSuccess(uint256 indexed tokenID, uint256 timestamp); //the dapp will see how much time the user have to redeem --> qr + countdown
    event RedeemedSuccess(uint256 indexed tokenID, address validator);
    event TicketForSale(uint256 indexed tokenID, uint256 salePrice);
    event TicketCancelledForSale(uint256 indexed tokenID, address ticketOwner);
    event TicketSold(uint256 indexed tokenID,  uint256 salePrice, address seller, address buyer);


    constructor(){
        _disableInitializers(); //the constructor is only called once, so, the clones will have disab
    }


    /************************************
    *           INITIALIZER             *
    ************************************/
     function initialize(
        string memory _name,
        string memory _symbol,
        uint256 _ticketPrice,
        uint256 _maxSupply,
        string memory _baseTokenURI,
        uint256 _maxTicketsPerAddress,
        bool _useTimeLimit, 
        uint256 _eventEndTime,
        address _owner
    )  initializerERC721A external initializer {

        //imports
        __ERC721A_init(_name, _symbol);
        __Ownable_init(_owner); // if we put the msg.sender as the owner, then the owner will be the addr of the fabric, not the user behind the fabric. 
        __AccessControl_init();
        __ReentrancyGuard_init();

        //global variables of each clone
        ticketPrice = _ticketPrice;
        maxSupply = _maxSupply;
        baseTokenURI = _baseTokenURI;
        maxTicketsPerAddress = _maxTicketsPerAddress;
        useTimeLimit = _useTimeLimit;
        pendingDuration = 600;//you have 10 minutes to redeem the pending ticket
        if (_useTimeLimit) {
            eventEndTime = block.timestamp + _eventEndTime * 3600;
        }
        _grantRole(DEFAULT_ADMIN_ROLE, _owner); //the deployer of the contract will be the admin
        _grantRole(VALIDATOR_ROLE, _owner); // create the new role VALIDATOR asisgned to the owner
    }


    /************************************
    *           USER FUNCTIONS          *
    ************************************/

    /****** allows to users create tickets (if the usr doens't owned more ticktes than the limit) ******/ 
    function mintTickets(uint256 quantity) external payable nonReentrant{

        if(useTimeLimit == true){//if the event don`t finished we can still minting tickets
            require(block.timestamp < eventEndTime, "the event has finished");
        }
        uint256 totalPrice = ticketPrice * quantity;
        require(msg.value >= totalPrice, "insuficient founds");//lets check if the user put in the transaction the amount to purchase the ticket
        require(totalSupply() + quantity <= maxSupply, "exceeded the maximum supply of tickets");//lets check if we dont exceed the max tickets supply 
        require(ticketsPurchased[msg.sender] + quantity <= maxTicketsPerAddress, "limit of owned tickeds reached");//the user can't own more than X ticktes (historically)
        
        ticketsPurchased[msg.sender] += quantity;
        uint256 startTokenID = totalSupply(); //if the usr bought more than 1 ticket, we need too store all the infromation about 
        _safeMint(msg.sender, quantity);
        
        for(uint256 i =0; i < quantity; i++){ // put the default params of the ticket
            uint256 tokenID = startTokenID + i;
            tickets[tokenID] = Ticket({
                status: TicketStatus.Active,
                pendingSince: 0,
                salePrice: 0,
                seller: address(0)
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
    function setPendingToTKT(uint256 tokenID) external {

        if(useTimeLimit){
            require(block.timestamp < eventEndTime, "the event has finished");
        }
        require(ownerOf(tokenID) == msg.sender, "you are not the owner of this ticket");

        //two possibilities to put in pending a ticket:

        //when the ticket is in pendign but the time to redeem it has expired
        if (tickets[tokenID].status == TicketStatus.Pending){ 
            require(block.timestamp > tickets[tokenID].pendingSince + pendingDuration, "ticket pending period has not expired yet");

        }
        else{ //when the ticket is in active state
            require(tickets[tokenID].status == TicketStatus.Active, "only Active tickets can be changed to Pending");
            tickets[tokenID].status = TicketStatus.Pending;
        }

        tickets[tokenID].pendingSince = block.timestamp;
        emit PendingSuccess(tokenID, block.timestamp);
    }

    //sets a ticket with pending state to redeemed state (this function will be called by the validator)
    function setRedeemedToTKT(uint256 tokenID) external onlyRole(VALIDATOR_ROLE) { //only validators can redeem a pending ticket to ensure the usr enters the event [the validator can be an automatic machine]

        if(useTimeLimit){
            require(block.timestamp < eventEndTime, "the event has finished");
        }

        require(tickets[tokenID].status == TicketStatus.Pending, "only Pending tickets can be redeemed");

        //cant redeem if the timelimit exceeds the timestamp
        require(block.timestamp < tickets[tokenID].pendingSince + pendingDuration, "the time to redeem the ticket has expired, re activate the pending status");


        tickets[tokenID].status = TicketStatus.Redeemed;
        emit RedeemedSuccess(tokenID, msg.sender); //msg.sender bc if a validator is a human and has a bad behaviour, we can identify them, or if a machine didnt redeem as much as others we can check if something its wrong.

    }

    function addTicketsForSale(uint256 tokenID, uint256 price ) external {

        if(useTimeLimit){
            require(block.timestamp < eventEndTime, "the event has finished");
        }
        require(ownerOf(tokenID) == msg.sender, "you are not the owner of this ticket");
        _checkPendingStateIsFinished(tokenID); //the usr can't put to sell a ticket that is still in pending state (when the pending time has not finished)
        require(tickets[tokenID].status == TicketStatus.Active, "only Active tickets can be sold"); // in this case, ensures that is not Redeemed
        
        // operation with 0.3 it's incorrect bc is an integer!!!
        require( price < (ticketPrice * 130) / 100, "the ticket cannot be sold for more than 30% above the original price");

        tickets[tokenID].seller = msg.sender;
        tickets[tokenID].salePrice = price;

        // now, the ticketNFT will belong to the smart contract, thats because if someone pays the price,
        // the smart contrcat will transfer the amount to the seller, and the ticket to the buyer

        safeTransferFrom(msg.sender, address(this), tokenID, ""); //ERC721AUpgradeable 
        emit TicketForSale(tokenID, price);

    }

    function cancelTicketForSale(uint256 tokenID) external{
        // you can also cancel the sale if the event has finished in order to get back your ticket 

        require(tickets[tokenID].seller != address(0), "the ticket is not for sale");
        //it's needed to check that is the seller who wants to get back his ticket from the smart contract
        require(tickets[tokenID].seller == msg.sender, "you are not the owner of this ticket");
        

        tickets[tokenID].seller = address(0);
        tickets[tokenID].salePrice = 0;

        // until now, the contract is the owner, thats bc the "this." is nedeed inn order to make the transfer 
        // in the name of the smart contract (teh actual owner)
        // if it's called without "this." the msg.sender will be the user, and if the token is on sale, it not belongs to him
        this.safeTransferFrom(address(this), msg.sender, tokenID, ""); //msg.sender is the seller bc it's a requirement in the top of the function
        emit TicketCancelledForSale(tokenID, msg.sender);
        

    }

    function buyTicket(uint256 tokenID) external payable nonReentrant{

        if(useTimeLimit){
            require(block.timestamp < eventEndTime, "the event has finished");
        }

        require(tickets[tokenID].seller != msg.sender, "cannot buy your own ticket");
        require(tickets[tokenID].seller != address(0), "the ticket is not for sale");
        require(ticketsPurchased[msg.sender] + 1 <= maxTicketsPerAddress, "limit of owned tickeds reached");
        require(msg.value >= tickets[tokenID].salePrice, "insuficient founds");

        uint256 salePrice = tickets[tokenID].salePrice;
        address seller = tickets[tokenID].seller;

        ticketsPurchased[msg.sender] += 1;
        tickets[tokenID].salePrice = 0;
        tickets[tokenID].seller = address(0);
        this.safeTransferFrom(address(this), msg.sender, tokenID, "");
        payable(seller).transfer(salePrice);

         //return the remaining amount
        if(msg.value > salePrice){
            uint256 refound = msg.value - salePrice;
            payable(msg.sender).transfer(refound);
            emit RefundIssued(msg.sender, refound); // notify the user

        }

        emit TicketSold(tokenID, salePrice, seller, msg.sender);
        
    }

    function tokenURI(uint256 tokenID) public view override returns (string memory) {

        require(_exists(tokenID), "the token does not exists");
        return string(abi.encodePacked(baseTokenURI, Strings.toString(tokenID)));
    }


    /************************************
    *              INTERNAL             *
    ************************************/

    //smart contracts can't make time events for do smthg. When the user wants to do smthg after put the pending state
    // (and the pending time finishes), we have to change the state automatically before doing the requested action.
    function _checkPendingStateIsFinished(uint256 tokenID) internal {

        if(tickets[tokenID].status == TicketStatus.Pending){
            if(tickets[tokenID].pendingSince + pendingDuration < block.timestamp){  //check if the pendign time has finished

                tickets[tokenID].status = TicketStatus.Active;
            
            }
            else{ //if the ticket is still pending, 
                revert("ticket is still pending. Wait until you take any further action");
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

    //if it's nedeed to reestablish the pending duration (in seconds for more control)
    function setPendingDuration(uint256 _seconds) external onlyOwner {
        
        pendingDuration = _seconds;
    }


    /*     ROLE MANAGEMENT      */
    function addValidator(address newValidator) external onlyOwner {
        _grantRole(VALIDATOR_ROLE, newValidator);
    }

    function removeValidator(address validator) external onlyOwner{
        _revokeRole(VALIDATOR_ROLE, validator);
    }


    /************************************
    *             OVERRIDE              *
    ************************************/

    /****** overrides ERC721AUpgradeable, AccessControlUpgradeable to follow ERC165******/
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721AUpgradeable, AccessControlUpgradeable) returns (bool) {
        return ERC721AUpgradeable.supportsInterface(interfaceId) || AccessControlUpgradeable.supportsInterface(interfaceId);
    }

    //in order to let the smart contract NFTs, it has to implement the ERC721Receiver to ensure it knows how to properly manipulate NFTs and the recived NFT won't be blocked there
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }


    // in order to protect users, any pending tciket or ticket on sale can't be transfered, including the standard transfers with ERC721
    function _beforeTokenTransfers(address from, address to, uint256 tokenID, uint256 quantity) internal override { // this will execute when mint, transferFrom
        
        if (from != address(0) && to != address(0) && quantity == 1 ) {
            _checkPendingStateIsFinished(tokenID);
            
            if(tickets[tokenID].seller != address(0)){ //if the ticket is on sale, transfers are resticted only to put 
                    
                //when we arrive here, the addTicketForSale() puts the info of the seller and the price in the tikcet, before making the trsnfer
                // thats bc it's needed to look if the transfer that is going to make is to put the contract as owner of the ticket 
                //(The ticket is in the process of being put on sale)
                bool isListingSale = (from == tickets[tokenID].seller && to == address(this)); //the case wehn the user whants to put his ticket on sale 

                //if the request is from the smart contract and to is the seller --> 
                //the user is trying to get back his ticket that is on sale, and the actual owner (the smart contract) has to auhorize the transfer
                bool isCancelSale = (from == address(this) && to == tickets[tokenID].seller); 

                    //If the ticket is for sale or is being put up for sale, we cannot transfer it to another person with TransferFrom
                if (!isListingSale && !isCancelSale) { 
                    revert("Please cancel the ticket sale first");
                    //this revert is just in case a user finds a way to do the transfer, but, the owner of the token is the smart contract when the token is for sale
                    // so the real owner (the seller) can't transfer his token bc it not belongs to him (while it's for sale) 
                }
            }
        }

    }
    
}