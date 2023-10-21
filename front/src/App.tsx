import React from 'react'
import Header from 'src/components/Header'
import { ChakraProvider, Box } from "@chakra-ui/react";
import Main from 'src/components/Main';
// import {initialize} from 'src/scripts/utils/setup';
import { useEffect } from 'react';
import chakraDefaultTheme from 'src/theme'
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