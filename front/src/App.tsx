import React from 'react'
import Header from 'src/components/Header'
import { ChakraProvider, Box } from "@chakra-ui/react";
import Main from 'src/components/Main';
import {setup} from 'src/scripts/utils/setup';
import { useEffect } from 'react';
import chakraDefaultTheme from 'src/theme'
function App() {
  useEffect(() => {
    async function init() {
      await setup()
    }
    init();
  }, [])

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