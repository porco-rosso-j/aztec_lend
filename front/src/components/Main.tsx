// TransferTabs.tsx

import {
  Select, Spinner, Card, Box, Tabs, TabList, Tab, TabPanels, TabPanel,
  Input, Flex, Button, Stat,
} from "@chakra-ui/react";
import { useState, useEffect } from 'react'
import { depositDAI, withdrawSDAI } from 'src/scripts/sdai-deposit';
import { depositUSDC, withdrawCUSDC } from 'src/scripts/cusdc-deposit';
import { userAztecAddr } from 'src/scripts/utils/constants';
import { getBalances } from "src/scripts/utils/balance"
import { shorterHash } from "src/scripts/utils/helpers"
// import { initialize } from "src/scripts/utils/setup";

const Main = () => {
  const [loading, setLoading] = useState(false);

  // deposit 
  const [depositToken, setDepositToken] = useState('DAI');
  const [depositAmount, setDepositAmount] = useState(0);

  // withdraw 
  const [withdrawToken, setWithdrawToken] = useState('SDAI');
  const [withdrawAmount, setWithdrawAmount] = useState(0);

  // balances
  const [DAIBalance, setDAIBalance] = useState(0);
  const [SDAIBalance, setSDAIBalance] = useState(0);
  const [USDCBalance, setUSDCBalance] = useState(0);
  const [CUSDCBalance, setCUSDCBalance] = useState(0);

  useEffect(() => {
    const timeOutId = setTimeout(async () => {
      const tokenbalances = await getBalances();
      setDAIBalance(Number(tokenbalances.DAI));
      setSDAIBalance(Number(tokenbalances.SDAI));
      setUSDCBalance(Number(tokenbalances.USDC));
      setCUSDCBalance(Number(tokenbalances.CUSDC));

    }, 300);
    return () => clearTimeout(timeOutId);
  });

  const onDeposit = async () => {
    setLoading(true);
    if (depositAmount === 0) {
      console.log("invalid amount")
      return;
    }
    console.log("depositToken: ", depositToken)
    try {
      if (depositToken === 'DAI') {
          await depositDAI(depositAmount)
      } else {
          await depositUSDC(depositAmount)
      }
    } catch (err) {
      setLoading(false);
      console.error(err);
    }
    setLoading(false);
  }

    const onWithdraw = async () => {
      setLoading(true);
      if (withdrawAmount === 0) {
          console.log("invalid amount")
          return;
        }
      try {
        if (withdrawToken === 'SDAI') {
          await withdrawSDAI(withdrawAmount)
        } else {
          await withdrawCUSDC(withdrawAmount)
        }
      } catch (err) {
        setLoading(false);
        console.error(err);
      }
      setLoading(false);
    }

  return (
    <Box>
      <Card mb="35px" p="15px" variant='darkCard'>
       <Box mb={2} fontSize={18}>Account: { shorterHash(userAztecAddr.toString())} </Box>
       <Box mb={2} fontSize={18}>Balances:</Box>
        <Stat>
           DAI: {DAIBalance / 1e18}
        </Stat>
        <Stat>
          SDAI: {SDAIBalance / 1e18}
        </Stat>
        <Stat>
          USDC: {USDCBalance / 1e6}
        </Stat>
        <Stat>
         CUSDC: {CUSDCBalance / 1e6}
        </Stat>
      </Card>
      <Tabs variant="line" borderColor="gray" >
        <TabList>
          <Tab w="50%" color="white">deposit</Tab>
          <Tab w="50%" color="white">withdraw</Tab>
        </TabList>
        <TabPanels>
          <TabPanel >
            <Box p={4} mb={4} borderRadius="none">
              <Box mb={4}>
                <label>1: token</label>
                <Select placeholder='Select Asset' borderColor="gray" defaultValue={'DAI'} onChange={(e) => setDepositToken(e.target.value)}>
                  <option value='DAI'> DAI to Savings DAI </option>
                  <option value='USDC'> USDC to Compound </option>
                </Select>
              </Box>
              <Box mb={4}>
              <label>2: amount</label>
              <Input placeholder="10" borderColor="gray" onChange={(e) => setDepositAmount(Number(e.target.value))} />
              </Box>
              <Button onClick={onDeposit} w="100%" mt="16px">Confirm</Button>
              {loading && <Flex minH={200} justifyContent="center" alignItems="center"
                pos="absolute" left="0" top="0" right="0" bottom="0" background="white" opacity={0.5}>
                <Spinner color='gray.800' />
              </Flex>}
            </Box>
          </TabPanel>
          <TabPanel>
          <Box p={4} mb={4} borderRadius="md" boxShadow="md" pos="relative">
              <Box mb={4}>
                <label>1: token</label>
                <Select placeholder='Select Asset'  borderColor="gray"  defaultValue={'SDAI'} onChange={(e) => setWithdrawToken(e.target.value)}>
                  <option value='SDAI'> DAI from Savings DAI </option>
                  <option value='CUSDC'> CUSDC from Compound </option>
                </Select>
              </Box>
              <Box mb={4}>
              <label>2: amount</label>
              <Input placeholder="10" borderColor="gray" onChange={(e) => setWithdrawAmount(Number(e.target.value))} />
              </Box>
              <Button onClick={onWithdraw} w="100%" mt="16px">Confirm</Button>
              {loading && <Flex minH={200} justifyContent="center" alignItems="center"
                pos="absolute" left="0" top="0" right="0" bottom="0" background="white" opacity={0.5}>
                <Spinner color='gray.800' />
              </Flex>}
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

    </Box >
  );
};

export default Main;
