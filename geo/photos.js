// Explicit food-image selections reviewed 2026-10-30; provenance: data/selected-food-media.json.
// Keep separate from the article-thumbnail generator so regeneration cannot restore homonym errors.
import {PHOTOS as ARTICLE_PHOTOS} from './atlas.js?v=clues-20261025';
export const PHOTO_OVERRIDES = {
  "Мамалыга": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/Mamaliga_right.jpg/960px-Mamaliga_right.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
  "Симит": "https://upload.wikimedia.org/wikipedia/commons/e/ef/Simit%2C_salah_satu_roti_khas_Turki.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled",
  "Фейжоада": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Feijoada_%C3%A0_brasileira_1.jpg/960px-Feijoada_%C3%A0_brasileira_1.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
  "Асадо": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/Asado_a.jpg/960px-Asado_a.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
  "Гуляш": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Hungarian_goulash_soup.jpg/960px-Hungarian_goulash_soup.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
  "Калитки": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Karjalanpiirakka.png/960px-Karjalanpiirakka.png?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
  "Путин (блюдо)": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/Poutine_from_Windsor%2C_ON.jpg/960px-Poutine_from_Windsor%2C_ON.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
  "Тажин": "https://upload.wikimedia.org/wikipedia/commons/e/e7/Moroccan_Tagine_%2817349530745%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled",
  "Лакса": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/Mixed_Vegetables_with_Singapore_Laksa_Noodles_Soup_-_Noodles_Soup%2C_Brighton.jpg/960px-Mixed_Vegetables_with_Singapore_Laksa_Noodles_Soup_-_Noodles_Soup%2C_Brighton.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
  "en:Cuisine of Papua New Guinea": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/A_Mumu_in_Papua_New_Guinea.jpg/960px-A_Mumu_in_Papua_New_Guinea.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
  "Лаваш": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Lavash_arm%C3%A9nien.jpg/960px-Lavash_arm%C3%A9nien.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
  "en:Omani cuisine": null
};
export const PHOTOS = {...ARTICLE_PHOTOS,...PHOTO_OVERRIDES};
