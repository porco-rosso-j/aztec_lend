// docs:start:uniswap_public_content_hash
use dep::aztec::hash::sha256_to_field;

// https://github.com/AztecProtocol/aztec-packages/blob/aztec-packages-v0.9.0/yarn-project/noir-contracts/src/contracts/uniswap_contract/src/util.nr

// This method computes the L2 to L1 message content hash for the public
// refer `l1-contracts/test/portals/UniswapPortal.sol` on how L2 to L1 message is expected
pub fn compute_deposit_public_content_hash(
    input_asset_bridge_portal_address: Field,
    input_amount: Field,
    output_asset_bridge_portal_address: Field,
    aztec_recipient: Field,
    secret_hash_for_L1_to_l2_message: Field,
    deadline_for_L1_to_l2_message: Field,
    canceller_for_L1_to_L2_message: Field,
    caller_on_L1: Field,
) -> Field {
    let mut hash_bytes: [u8; 260] = [0; 260]; // 8 fields of 32 bytes each + 4 bytes fn selector

    let input_token_portal_bytes = input_asset_bridge_portal_address.to_be_bytes(32);
    let in_amount_bytes = input_amount.to_be_bytes(32);
    let output_token_portal_bytes = output_asset_bridge_portal_address.to_be_bytes(32);
    let aztec_recipient_bytes = aztec_recipient.to_be_bytes(32);
    let secret_hash_for_L1_to_l2_message_bytes = secret_hash_for_L1_to_l2_message.to_be_bytes(32);
    let deadline_for_L1_to_l2_message_bytes = deadline_for_L1_to_l2_message.to_be_bytes(32);
    let canceller_bytes = canceller_for_L1_to_L2_message.to_be_bytes(32);
    let caller_on_L1_bytes = caller_on_L1.to_be_bytes(32);

    // selector for depositPublic() == 0x076fcbc8
    hash_bytes[0] = 0x07;
    hash_bytes[1] = 0x6f;
    hash_bytes[2] = 0xcb;
    hash_bytes[3] = 0xc8;


    for i in 0..32 {
        hash_bytes[i + 4] = input_token_portal_bytes[i];
        hash_bytes[i + 36] = in_amount_bytes[i];
        hash_bytes[i + 68] = output_token_portal_bytes[i];
        hash_bytes[i + 100] = aztec_recipient_bytes[i];
        hash_bytes[i + 132] = secret_hash_for_L1_to_l2_message_bytes[i];
        hash_bytes[i + 164] = deadline_for_L1_to_l2_message_bytes[i];
        hash_bytes[i + 196] = canceller_bytes[i];
        hash_bytes[i + 228] = caller_on_L1_bytes[i];
    }

    let content_hash = sha256_to_field(hash_bytes);
    content_hash
}
// docs:end:uniswap_public_content_hash

// docs:start:compute_swap_private_content_hash
// This method computes the L2 to L1 message content hash for the private
// refer `l1-contracts/test/portals/UniswapPortal.sol` on how L2 to L1 message is expected
pub fn compute_deposit_private_content_hash(
    input_asset_bridge_portal_address: Field,
    input_amount: Field,
    output_asset_bridge_portal_address: Field,
    secret_hash_for_redeeming_minted_notes: Field,
    secret_hash_for_L1_to_l2_message: Field,
    deadline_for_L1_to_l2_message: Field,
    canceller_for_L1_to_L2_message: Field,
    caller_on_L1: Field,
) -> Field {
    let mut hash_bytes: [u8; 260] = [0; 260]; // 8 fields of 32 bytes each + 4 bytes fn selector

    let input_token_portal_bytes = input_asset_bridge_portal_address.to_be_bytes(32);
    let in_amount_bytes = input_amount.to_be_bytes(32);
    let output_token_portal_bytes = output_asset_bridge_portal_address.to_be_bytes(32);
    let secret_hash_for_redeeming_minted_notes_bytes = secret_hash_for_redeeming_minted_notes.to_be_bytes(32);
    let secret_hash_for_L1_to_l2_message_bytes = secret_hash_for_L1_to_l2_message.to_be_bytes(32);
    let deadline_for_L1_to_l2_message_bytes = deadline_for_L1_to_l2_message.to_be_bytes(32);
    let canceller_bytes = canceller_for_L1_to_L2_message.to_be_bytes(32);
    let caller_on_L1_bytes = caller_on_L1.to_be_bytes(32);

    // function selector: 0x42f5fc44 for depositPrivate
    hash_bytes[0] = 0x42;
    hash_bytes[1] = 0xf5;
    hash_bytes[2] = 0xfc;
    hash_bytes[3] = 0x44;

    for i in 0..32 {
        hash_bytes[i + 4] = input_token_portal_bytes[i];
        hash_bytes[i + 36] = in_amount_bytes[i];
        hash_bytes[i + 68] = output_token_portal_bytes[i];
        hash_bytes[i + 100] = secret_hash_for_redeeming_minted_notes_bytes[i];
        hash_bytes[i + 132] = secret_hash_for_L1_to_l2_message_bytes[i];
        hash_bytes[i + 164] = deadline_for_L1_to_l2_message_bytes[i];
        hash_bytes[i + 196] = canceller_bytes[i];
        hash_bytes[i + 228] = caller_on_L1_bytes[i];
    }
    let content_hash = sha256_to_field(hash_bytes);
    content_hash
}
// docs:end:compute_swap_private_content_hash