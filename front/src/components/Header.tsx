import { Flex, Box } from '@chakra-ui/react'
export default function Header() {
    return <Flex flexDirection="column" mb="50px" p="60px" boxShadow="sm" alignItems="center" h="60px" >
    <Box fontSize={30} >
      AztecLend
    </Box>
    <Box marginTop="8px">
        Privately deposit assets to L1 DeFi protocol and earn yield.
    </Box>
  </Flex >
}