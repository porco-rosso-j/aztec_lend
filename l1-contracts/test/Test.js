const { ethers, network } = require("hardhat");
const BigNumber = ethers.BigNumber;

describe("Test", function () {
  describe("AztecLend", function () {
    it("Should deposit public", async function () {
      // const from = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
      // await network.provider.request({
      //   method: "hardhat_impersonateAccount",
      //   params: [from]
      // });

      // const signer = await ethers.getSigner(from);

      // let aztecLendInterface = new ethers.utils.Interface(['function depositPublic(address,uint256,address,bytes32,bytes32,uint32,address,bool)'])
      // const data = aztecLendInterface.encodeFunctionData('depositPublic', 
      // [
      //   "0x5fe2f174fe51474cd198939c96e7db65983ea307",
      //   BigNumber.from("1000000000000000000000"),
      //   "0x061fb3749c4ed5e3c2d28a284940093cfdfcba20",
      //   "0x27b50b1ab128fb6b9befdcd2df94d0855bf1cc705b068599e8ac4feded7e2dab",
      //   "0x01a606d2a464ef211cc4f79bc7c816045fef7187ac3dab8db77e167e060e8f5f",
      //   4294967295,
      //   "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      //   true
      // ]);

      // const tx = {
      //   to: "0xf0f5e9b00b92f3999021fd8b88ac75c351d93fc7",
      //   data: data,
      //   gasLimit: 10000000
      // };
      // const receipt = await signer.sendTransaction(tx);
      
      // await receipt.wait();
    });
  });
});
