// TransferTabs.tsx

import {
    Select, Spinner, Card, CardBody, Box, Tabs, TabList, Tab, TabPanels, TabPanel,
    Input, Flex, Button, StatNumber, Stat, StatLabel
  } from "@chakra-ui/react";
  import { useState, useEffect } from 'react'
  import { depositDAI, claimSDAI } from 'src/scripts/sdai';
  import { depositUSDC, claimCUSDC } from 'src/scripts/compound';
  import { TOKEN_ADDRESSES, CONTRACT_ADDRESSES } from 'src/scripts/utils/constants';
  import { getBalances } from "src/scripts/utils/balance"
  import { shorterHash } from "src/scripts/utils/helpers"

  const Main = () => {
    const [loading, setLoading] = useState(false);

    // deposit 
    const [depositToken, setDepositToken] = useState('');
    const [depositAmount, setDepositAmount] = useState(0);

    // claim 
    const [claimToken, setClaimToken] = useState('');
    const [claimAmount, setClaimAmount] = useState(0);

    // withdraw
    const [withdrawToken, withdrawDepositToken] = useState('')
    const [withdrawAmount, setWithdrawAmount] = useState('');
  
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

      const onClaim = async () => {
        setLoading(true);
        if (claimAmount === 0) {
            console.log("invalid amount")
            return;
          }
        try {
          if (claimToken === 'SDAI') {
            await claimSDAI(claimAmount)
          } else {
            await claimCUSDC(claimAmount)
          }
        } catch (err) {
          setLoading(false);
          console.error(err);
        }
        setLoading(false);
      }

      const onWithdraw = async () => {
        setLoading(true);
        try {
        } catch (err) {
          setLoading(false);
          console.error(err);
        }
        setLoading(false);
      }
  
    return (
      <Box>
        <Card mb="20px" p="16px" variant='darkCard'>
          <Box mb={2} fontSize={20}>Balances</Box>
          <Stat>
            <StatLabel>DAI</StatLabel>
            <StatNumber> {DAIBalance / 1e18}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>SDAI</StatLabel>
            <StatNumber> {SDAIBalance / 1e18}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>USDC</StatLabel>
            <StatNumber> {USDCBalance / 1e6}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>CUSDC</StatLabel>
            <StatNumber> {CUSDCBalance / 1e6}</StatNumber>
          </Stat>
        </Card>
        <Tabs variant="enclosed">
          <TabList>
            <Tab w="50%" color="white">deposit</Tab>
            <Tab w="50%" color="white">claim</Tab>
          </TabList>
          <TabPanels>
            <TabPanel >
              <Box p={4} mb={4} borderRadius="md" boxShadow="md" pos="relative">
                <Box mb={4}>
                  <label>deposit token and protocol</label>
                  <Select placeholder='Select Asset' onChange={(e) => setDepositToken(e.target.value)}>
                    <option value='USDC' selected> DAI to Savings DAI </option>
                    <option value='WETH'> USDC to Compound </option>
                  </Select>
                </Box>
                <Box mb={4}>
                <label>2. amount</label>
                <Input placeholder="10" onChange={(e) => setDepositAmount(Number(e.target.value))} />
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
                  <label>claim token and protocol</label>
                  <Select placeholder='Select Asset' onChange={(e) => setDepositToken(e.target.value)}>
                    <option value='SDAI' selected> DAI from Savings DAI </option>
                    <option value='CUSDC'> CUSDC from Compound </option>
                  </Select>
                </Box>
                <Box mb={4}>
                <label>2. amount</label>
                <Input placeholder="10" onChange={(e) => setClaimAmount(Number(e.target.value))} />
                </Box>
                <Button onClick={onClaim} w="100%" mt="16px">Confirm</Button>
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
  