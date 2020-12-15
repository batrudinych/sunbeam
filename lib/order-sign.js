'use strict'

// this is a helper class for signing transactions
// needs http to get contract abis from an eos node.

class SignHelper {
  constructor (client) {
    this.client = client
    this.expireInSeconds = 24 * 60 * 60
  }

  getTxHeaders (meta, { expireSeconds } = {}) {
    expireSeconds = expireSeconds || this.conf.eos.expireInSeconds

    const [
      headBlockTime,
      lastIrreversibleBlockNumber,
      chainId,
      refBlockPrefix
    ] = meta

    let expiration = new Date(+headBlockTime * 1000 + (expireSeconds * 1000))
    expiration = expiration.toISOString().split('.')[0]

    const transactionHeaders = {
      expiration,
      ref_block_num: lastIrreversibleBlockNumber & 0xFFFF,
      ref_block_prefix: +refBlockPrefix
    }

    return [transactionHeaders, chainId]
  }

  fixTx (transfer) {
    const fixed = this.client.api.deserializeTransaction(transfer.serializedTransaction)
    fixed.signatures = transfer.signatures

    return fixed
  }

  getSignTxOpts ({ broadcast = false, expireInSeconds = this.expireInSeconds, blocksBehind = 3 } = {}) {
    return {
      broadcast,
      blocksBehind,
      expireSeconds: expireInSeconds
    }
  }

  async signTx (payload, auth, action, meta, contract, txOpts = {}) {
    const { account, permission, addAuth } = auth
    const authorization = [{ actor: account, permission: permission }]

    if (addAuth && addAuth.account && addAuth.permission) {
      authorization.push({ actor: addAuth.account, permission: addAuth.permission })
    }

    const txdata = {
      actions: [{
        account: contract,
        name: action,
        authorization,
        data: payload
      }]
    }

    const opts = { broadcast: txOpts.broadcast || false }

    if (txOpts.expiration) {
      const [, lastIrreversibleBlockNumber, , refBlockPrefix] = meta

      Object.assign(txdata, {
        expiration: txOpts.expiration,
        ref_block_num: lastIrreversibleBlockNumber & 0xFFFF,
        ref_block_prefix: +refBlockPrefix
      })
    } else {
      Object.assign(opts, this.getSignTxOpts(txOpts))
    }

    if (this.client.ual) {
      const res = await this.client.ual.signTransaction(txdata, opts)
      return this.fixTx(res.transaction)
    }

    const res = await this.client.api.transact(txdata, opts)
    return this.fixTx(res)
  }
}

module.exports = SignHelper
