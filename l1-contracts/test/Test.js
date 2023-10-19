const { ethers, network } = require("hardhat");
const BigNumber = ethers.BigNumber;

describe("Test", function () {
  describe("AztecLend", function () {
    it("Should deposit public", async function () {
      const from = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [from]
      });

      const signer = await ethers.getSigner(from);

      let daiSavingsInterface = new ethers.utils.Interface(['function depositPublic(address,uint256,address,bytes32,bytes32,uint32,address,bool)'])
      const data = daiSavingsInterface.encodeFunctionData('depositPublic', ["0x4a351c6ae3249499cbb50e8fe6566e2615386da8", BigNumber.from("1000000000000000000000"), "0xa95a928eec085801d981d13ffe749872d8fd5bec", "0x22bb87ed890ae70c368b79819ff0eda56e5feb592a39e02c5aa1a63cdfaf5ec2", "0x28a42f991ae5ced1201cff20f4fe3636fc43203a89b5ae124fe64eb464b5dd3b", 4294967295, "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", true]);

      const tx = {
        to: "0xcb0a9835cdf63c84fe80fcc59d91d7505871c98b",
        data: data,
        gasLimit: 10000000
      };
      const receipt = await signer.sendTransaction(tx);
      
      const f = await receipt.wait();
      console.log(f)
    });
  });
});

// 0x076fcbc80000000000000000000000004a351c6ae3249499cbb50e8fe6566e2615386da800000000000000000000000000000000000000000000003635c9adc5dea00000000000000000000000000000a95a928eec085801d981d13ffe749872d8fd5bec22bb87ed890ae70c368b79819ff0eda56e5feb592a39e02c5aa1a63cdfaf5ec228a42f991ae5ced1201cff20f4fe3636fc43203a89b5ae124fe64eb464b5dd3b00000000000000000000000000000000000000000000000000000000ffffffff000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb922660000000000000000000000000000000000000000000000000000000000000001
// 0x076fcbc80000000000000000000000004a351c6ae3249499cbb50e8fe6566e2615386da800000000000000000000000000000000000000000000003635c9adc5dea00000000000000000000000000000a95a928eec085801d981d13ffe749872d8fd5bec22bb87ed890ae70c368b79819ff0eda56e5feb592a39e02c5aa1a63cdfaf5ec228a42f991ae5ced1201cff20f4fe3636fc43203a89b5ae124fe64eb464b5dd3b00000000000000000000000000000000000000000000000000000000ffffffff000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb922660000000000000000000000000000000000000000000000000000000000000001