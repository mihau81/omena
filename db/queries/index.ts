export {
  getAuctions,
  getAuctionBySlug,
  getAuctionById,
  getAuctionWithLots,
} from './auctions';

export {
  getLotsByAuction,
  getLotById,
  getLotByAuctionAndNumber,
  searchLots,
  getSoldLots,
  getAuctionsForResults,
  getDistinctArtists,
} from './lots';

export type { LotCategory } from './lots';

export {
  getBidsForLot,
  getHighestBid,
  getUserBids,
} from './bids';

export {
  getMediaForLot,
  getPrimaryMedia,
} from './media';

export {
  getUserById,
  getUserByEmail,
  isUserRegisteredForAuction,
  listUsers,
  getUserDetail,
  getUserBidsPaginated,
  getUserRegistrationsPaginated,
  getUserWatchedLotsPaginated,
} from './users';

export {
  getTranslationsForLot,
  getTranslation,
  upsertTranslation,
  deleteTranslation,
} from './translations';

export {
  getConsignors,
  getConsignorById,
  getConsignorLots,
  createConsignor,
  updateConsignor,
  deleteConsignor,
  listActiveConsignors,
} from './consignors';

export {
  getTiersForAuction,
  upsertTiers,
} from './premium';

export {
  getArtists,
  getArtistById,
  getArtistBySlug,
  getArtistWithLots,
  getUnlinkedLotsByArtistName,
  createArtist,
  updateArtist,
  deleteArtist,
  linkLotsToArtist,
  getPublicArtists,
} from './artists';
