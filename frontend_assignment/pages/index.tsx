import detectEthereumProvider from "@metamask/detect-provider";
import { Strategy, ZkIdentity } from "@zk-kit/identity";
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols";
import { providers, Contract, utils } from "ethers";
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";
import Head from "next/head";
import React, { useEffect } from "react"
import styles from "../styles/Home.module.css";
import { useFormik } from "formik";
import { Link } from "react-scroll";
import { AiOutlineDown } from "react-icons/ai";
import { object, string, number, date, InferType } from "yup";
import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Input,
  VStack,
  NumberInput,
  Heading,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Text
} from "@chakra-ui/react";
import { ethers } from "hardhat";

export default function Home() {

  useEffect(() => {
    //configure event listener to display to user
    const contract = new Contract(
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      Greeter.abi
    );
    const provider = new providers.JsonRpcProvider("http://localhost:8545");

    const contractOwner = contract.connect(provider.getSigner());

    

    contractOwner.on("NewGreeting", (greeting: string) => {
      console.log(utils.parseBytes32String(greeting));
      changeDialogText("Here's the greeting : " + utils.parseBytes32String(greeting));
      onOpen();
    });
  }, []);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef();

  const [logs, setLogs] = React.useState("Connect your wallet and greet!");
  const [dialogText, changeDialogText] = React.useState("");

  async function greet() {
    setLogs("Creating your Semaphore identity...");

    const provider = (await detectEthereumProvider()) as any;

    await provider.request({ method: "eth_requestAccounts" });

    const ethersProvider = new providers.Web3Provider(provider);
    const signer = ethersProvider.getSigner();
    const message = await signer.signMessage(
      "Sign this message to create your identity!"
    );

    const identity = new ZkIdentity(Strategy.MESSAGE, message);
    const identityCommitment = identity.genIdentityCommitment();
    const identityCommitments = await (
      await fetch("./identityCommitments.json")
    ).json();

    const merkleProof = generateMerkleProof(
      20,
      BigInt(0),
      identityCommitments,
      identityCommitment
    );

    setLogs("Creating your Semaphore proof...");

    const greeting = "Hello ZKU";

    const witness = Semaphore.genWitness(
      identity.getTrapdoor(),
      identity.getNullifier(),
      merkleProof,
      merkleProof.root,
      greeting
    );

    const { proof, publicSignals } = await Semaphore.genProof(
      witness,
      "./semaphore.wasm",
      "./semaphore_final.zkey"
    );
    const solidityProof = Semaphore.packToSolidityProof(proof);

    const response = await fetch("/api/greet", {
      method: "POST",
      body: JSON.stringify({
        greeting,
        nullifierHash: publicSignals.nullifierHash,
        solidityProof: solidityProof,
      }),
    });

    if (response.status === 500) {
      const errorMessage = await response.text();

      setLogs(errorMessage);
    } else {
      setLogs("Your anonymous greeting is onchain :)");
    }
  }

  let userSchema = object({
    name: string().required(),
    age: number().required().positive().integer().moreThan(18),
    email: string().email().required(),
  });

  const formik = useFormik({
    initialValues: {
      name: "",
      age: 18,
      email: "",
    },
    onSubmit: async (values) => {
      try {
        const userData = JSON.stringify(values, null, 2);
        const parsedUser = await userSchema.validate(values, { strict: true });
        console.log(userData);
      } catch (error) {
        console.log(error.message);
        // alert(error.message);
        changeDialogText(error.message);
        onOpen();
      }
    },
  });

  return (
    <VStack bg="#1F3D5A" textColor="white">
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Message
            </AlertDialogHeader>

            <AlertDialogBody>
              {dialogText}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Okay
              </Button>
              {/* <Button colorScheme="red" onClick={onClose} ml={3}>
                Delete
              </Button> */}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
      <Head>
        <title>Greetings</title>
        <meta
          name="description"
          content="A simple Next.js/Hardhat privacy application with Semaphore."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>Greetings</h1>

        <p className={styles.description}>
          A simple Next.js/Hardhat privacy application with Semaphore.
        </p>
       
       

        <div className={styles.logs}>{logs}</div>

        <div onClick={() => greet()} className={styles.button}>
          Greet
        </div>

        <Link
          to="formContainer"
          className={styles.scroller}
          spy={true}
          smooth={true}
          duration={500}
        >
          <AiOutlineDown />
        </Link>
      </main>

      <Flex id="formContainer" align="center" justify="center">
        <Box bg="white" textColor="black" p={10} rounded="lg" marginBottom="24">
          <Heading marginBottom="8" fontSize="3xl">
            Details
          </Heading>
          <form className={styles.form} onSubmit={formik.handleSubmit}>
            <VStack spacing={4} align="flex-start">
              <FormControl>
                <FormLabel htmlFor="name">Name</FormLabel>
                <Input
                  width="xl"
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="off"
                  onChange={formik.handleChange}
                  value={formik.values.name}
                />
              </FormControl>

              <FormControl>
                <FormLabel htmlFor="age">Age</FormLabel>
                <Input
                  id="age"
                  name="age"
                  type="number"
                  autoComplete="off"
                  onChange={formik.handleChange}
                  value={formik.values.age}
                />
              </FormControl>

              <FormControl>
                <FormLabel htmlFor="email">Email</FormLabel>
                <Input
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="off"
                  onChange={formik.handleChange}
                  value={formik.values.email}
                />
              </FormControl>

              <Button type="submit" colorScheme="green" width="full">
                Submit
              </Button>
            </VStack>
          </form>
        </Box>
        
      </Flex>
      <Text>
          Submitted by #suhasbr0908
          </Text>
    </VStack>
  );
}
