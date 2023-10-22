import React from 'react'
import Header from 'src/components/Header'
import { ChakraProvider, Box } from "@chakra-ui/react";
import Main from 'src/components/Main';
// import {initialize} from 'src/scripts/utils/setup';
import { useEffect } from 'react';
import chakraDefaultTheme from 'src/theme'
import {createPXEClient} from '@aztec/aztec.js' 
// @ts-ignore
import { fileURLToPath } from '@aztec/foundation/url';
import {PXE_URL} from './scripts/utils/constants'
function App() {


  // useEffect(() =>  {
  //   console.log("here?")
  //   const init = async () => {
  //     try {
  //       await initialize()
  //     } catch(error) {
  //       console.error(error)
  //     } 
  //     }
  //   init();
  //   // const timeOutId = setTimeout(async () => {
  //   //   await initialize()

  //   // }, 30000000);
  //   // return () => clearTimeout(timeOutId);
  // }, [])

  async function main() {
    const pxe = createPXEClient(PXE_URL);
    const { chainId } = await pxe.getNodeInfo();
    console.log(`Connected to chain ${chainId}`);
  }
  
  main()

  return <ChakraProvider theme={chakraDefaultTheme}>
      <div>
        <Header />
        <Box maxW='768px' mx="auto">
        <Main />
        </Box>
      </div>
  </ChakraProvider>
}

export default App