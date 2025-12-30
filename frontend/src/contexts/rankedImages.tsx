// Import rank images
import BronzeImg from "../assets/ranked-images/R-Bronze.png";
import SilverImg from "../assets/ranked-images/R-Silver.png";
import GoldImg from "../assets/ranked-images/R-Gold.png";
import PlatinumImg from "../assets/ranked-images/R-Platinum.png";
import DiamondImg from "../assets/ranked-images/R-Diamond.png";
import MasterImg from "../assets/ranked-images/R-Master.png";
import GrandMasterImg from "../assets/ranked-images/R-GrandMaster.png";
import ChampionImg from "../assets/ranked-images/R-Champion.png";

 // Map tier names to images
const rankImages: Record<string, string> = {
    'Bronze': BronzeImg,
    'Silver': SilverImg,
    'Gold': GoldImg,
    'Platinum': PlatinumImg,
    'Diamond': DiamondImg,
    'Master': MasterImg,
    'Grandmaster': GrandMasterImg,
    'Champion': ChampionImg,
};

export default rankImages;