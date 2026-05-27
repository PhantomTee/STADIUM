export const MATCH_ORACLE_ABI = [
  {
    inputs: [
      { name: 'externalFixtureId', type: 'uint256' },
      { name: 'matchId',           type: 'uint256' },
      { name: 'teamAId',           type: 'uint16'  },
      { name: 'teamBId',           type: 'uint16'  },
      { name: 'kickoffTime',       type: 'uint256' },
      { name: 'stage',             type: 'uint8'   },
    ],
    name: 'createOrUpdateMatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'matchId', type: 'uint256' }],
    name: 'openVARWindow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'matchId',   type: 'uint256' },
      { name: 'winner',    type: 'uint8'   },
      { name: 'firstGoal', type: 'uint8'   },
      { name: 'redCard',   type: 'bool'    },
      { name: 'extraTime', type: 'bool'    },
    ],
    name: 'postResult',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'teamId', type: 'uint16' }],
    name: 'postElimination',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'teamId', type: 'uint16' }],
    name: 'postChampion',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'matchId', type: 'uint256' }],
    name: 'getMatch',
    outputs: [
      {
        components: [
          { name: 'matchId',           type: 'uint256' },
          { name: 'teamAId',           type: 'uint16'  },
          { name: 'teamBId',           type: 'uint16'  },
          { name: 'teamAName',         type: 'string'  },
          { name: 'teamBName',         type: 'string'  },
          { name: 'kickoffTime',       type: 'uint256' },
          { name: 'varOpen',           type: 'bool'    },
          { name: 'varClosed',         type: 'bool'    },
          { name: 'settled',           type: 'bool'    },
          { name: 'winner',            type: 'uint8'   },
          { name: 'firstGoal',         type: 'uint8'   },
          { name: 'redCard',           type: 'bool'    },
          { name: 'extraTime',         type: 'bool'    },
          { name: 'stage',             type: 'uint8'   },
          { name: 'externalFixtureId', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAllMatchIds',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export const CONVICTION_VAULT_ABI = [
  {
    inputs: [{ name: '_time', type: 'uint256' }],
    name: 'setConvictionCloseTime',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'convictionCloseTime',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalAliveDeposits',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Used by getLogs for leaderboard indexing
export const CONVICTION_DEPOSITED_EVENT = {
  anonymous: false,
  inputs: [
    { indexed: true,  name: 'user',   type: 'address' },
    { indexed: true,  name: 'teamId', type: 'uint16'  },
    { name: 'amount', type: 'uint256' },
  ],
  name: 'ConvictionDeposited',
  type: 'event',
} as const
