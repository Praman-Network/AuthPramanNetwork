// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FaceRegistry {
    // Contract owner (the authorized relayer)
    address public owner;

    // Mapping from hashed face vector (bytes32) to registration state
    mapping(bytes32 => bool) private _registeredFaces;
    
    // Mapping from hashed face vector to associated IPFS CID
    mapping(bytes32 => string) private _faceCids;
    
    // Mapping from user address to their registered face hash (Sybil resistance)
    mapping(address => bytes32) private _userFaceHashes;

    // Unique identity and Sybil prevention mappings
    mapping(bytes32 => address) public faceToMasterWallet;
    mapping(address => bytes32) public addressToFace;

    event FaceRegistered(address indexed user, bytes32 indexed faceHash, string ipfsCid);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error FaceAlreadyRegistered();
    error UserAlreadyRegistered();
    error NotOwner();

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        _;
    }

    /**
     * @dev Transfers ownership of the contract to a new account.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @dev Checks if a face hash is already registered in the system.
     */
    function isFaceRegistered(bytes32 faceHash) public view returns (bool) {
        return faceToMasterWallet[faceHash] != address(0);
    }

    /**
     * @dev Gets the IPFS CID associated with a registered face hash.
     */
    function getFaceCid(bytes32 faceHash) public view returns (string memory) {
        require(faceToMasterWallet[faceHash] != address(0), "Face not registered");
        return _faceCids[faceHash];
    }

    /**
     * @dev Gets the registered face hash for a user wallet address.
     */
    function getUserFaceHash(address user) public view returns (bytes32) {
        return addressToFace[user];
    }

    /**
     * @dev Gets the IPFS CID for a user wallet address.
     */
    function getUserCid(address user) public view returns (string memory) {
        bytes32 faceHash = addressToFace[user];
        require(faceHash != bytes32(0), "User not registered");
        return _faceCids[faceHash];
    }

    /**
     * @dev Registers a face hash and links it to an IPFS CID on behalf of a user.
     * Can only be called by the contract owner (the Backend Relayer).
     */
    function registerFaceFor(address user, bytes32 hash, string memory cid) public onlyOwner {
        require(faceToMasterWallet[hash] == address(0), "Face already registered");
        require(addressToFace[user] == bytes32(0), "Wallet already registered");

        // Update mappings
        faceToMasterWallet[hash] = user;
        addressToFace[user] = hash;

        // Maintain legacy mappings for backward compatibility
        _registeredFaces[hash] = true;
        _faceCids[hash] = cid;
        _userFaceHashes[user] = hash;

        emit FaceRegistered(user, hash, cid);
    }

    /**
     * @dev Registers a face hash and links it to an IPFS CID (direct client transaction).
     * Prevents duplicates (Sybil resistance).
     */
    function registerFace(bytes32 hash, string memory cid) public {
        require(faceToMasterWallet[hash] == address(0), "Face already registered");
        require(addressToFace[msg.sender] == bytes32(0), "Wallet already registered");

        // Update mappings
        faceToMasterWallet[hash] = msg.sender;
        addressToFace[msg.sender] = hash;

        // Maintain legacy mappings for backward compatibility
        _registeredFaces[hash] = true;
        _faceCids[hash] = cid;
        _userFaceHashes[msg.sender] = hash;

        emit FaceRegistered(msg.sender, hash, cid);
    }
}
