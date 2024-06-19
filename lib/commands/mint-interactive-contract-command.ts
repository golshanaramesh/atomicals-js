import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { checkBaseRequestOptions } from "../utils/atomical-format-helpers";
import { jsonFileReader } from "../utils/file-utils";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { GetByProtocolCommand } from "./get-by-protocol-command";
import { readFileAsCompleteDataObject, readJsonFileAsCompleteDataObjectEncodeAtomicalIds, readJsonFileAsCompleteDataObjectEncodeFields, readJsonFileAsCompleteDataObjectEncodeHash } from "./command-helpers";
import { GetByContractCommand } from "./get-by-contract-command";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);

export class MintInteractiveContractCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private contractName: string,
    private protocolName: string,
    private argsFile: string,
    private address: string,
    private fundingWIF: string,
  ) {
    this.options = checkBaseRequestOptions(this.options)
  }

  async run(): Promise<any> {

    // Check if the request already exists
    const getExistingNameCommand = new GetByContractCommand(this.electrumApi, this.contractName, AtomicalsGetFetchType.GET);
    try {
      const getExistingNameResult = await getExistingNameCommand.run();
      if (getExistingNameResult.success && getExistingNameResult.data) {
        if (getExistingNameResult.data.result && getExistingNameResult.data.result.atomical_id || getExistingNameResult.data.candidates.length) {
          throw 'Already exists with that name. Try a different name.';
        }
      }
    } catch (err: any) {
      if (err.code !== 1) {
        throw err;  // Code 1 means call correctly returned that it was not found
      }
    }

    // Ensure protocol exists
    const getExistingNameCommand2 = new GetByProtocolCommand(this.electrumApi, this.protocolName, AtomicalsGetFetchType.GET);
    try {
      const getExistingNameResult = await getExistingNameCommand2.run();
      if (getExistingNameResult.success && getExistingNameResult.data) {
        if (getExistingNameResult.data.result && getExistingNameResult.data.result.atomical_id || getExistingNameResult.data.candidates.length) {
          // It exists
        } else {
          throw 'Protocol name does not exist.';
        }
      } else {
        throw 'Protocol name does not exist.';
      }
    } catch (err: any) {
      if (err.code !== 1) {
        throw err;  // Code 1 means call correctly returned that it was not found
      }
    }

    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      rbf: this.options.rbf,
      satsbyte: this.options.satsbyte,
      address: this.address,
      disableMiningChalk: this.options.disableMiningChalk,
      opType: 'new',
      nftOptions: {
        satsoutput: this.options.satsoutput as any
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });
    // Set to request a container
    atomicalBuilder.setRequestContract(this.contractName, this.protocolName);
    if (this.options.bitworkc) {
      atomicalBuilder.setBitworkCommit(this.options.bitworkc);
    }
    if (this.options.bitworkr) {
      atomicalBuilder.setBitworkReveal(this.options.bitworkr);
    }
    // Attach any default data
    //let filesData = await readJsonFileAsCompleteDataObjectEncodeFields(this.argsFile, []);
    // Hard code '00' script for now
    await atomicalBuilder.setContractDeployScript(Buffer.from('00', 'hex'));
    // The receiver output
    atomicalBuilder.addOutput({
      address: this.address,
      value: this.options.satsoutput as any || 1000
    });
    const result = await atomicalBuilder.start(this.fundingWIF);
    return {
      success: true,
      data: result
    }
  }
}
