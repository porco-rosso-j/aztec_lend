import { Flex, Box } from '@chakra-ui/react'
export default function Header() {
    return <Flex flexDirection="column" mb="120px" p="60px" boxShadow="sm" alignItems="center" h="100px" >
    <Box fontSize={75} >
    🌵 AztecLend 🌵
    </Box>
    <Box marginTop="8px">
        Privately deposit assets to L1 DeFi protocol and earn yield.
    </Box>
  </Flex >
}