import { createPublicClient, http, type Address } from 'viem'
import { celo } from 'viem/chains'
import { serverConfig } from '../env'
import { flowAllocation, readFlowSnapshot } from '../flowstate'

/**
 * Quiz entry gate: the verified wallet gives Jara at least one Flowstate vote right now.
 * Read live from the council (Jara's own voting flow in lib/flowstate.ts); nothing is stored,
 * so taking votes away closes the gate again. Demo mode has no council, so it always passes.
 */
export async function votesForJara(root: Address): Promise<boolean> {
  if (serverConfig().chain.mode === 'mock') return true
  const client = createPublicClient({ chain: celo, transport: http(serverConfig().chain.rpcUrl) })
  return flowAllocation(await readFlowSnapshot(client, root)).current > 0n
}
