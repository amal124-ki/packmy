"""
Seed (fill) the database with sample Malaysian tourism data and two demo accounts.

    python seed.py          -> create tables + add sample data (only if empty)
    python seed.py --reset  -> DELETE everything and start fresh

NOTE FOR THE TEAM: prices, opening hours and coordinates are approximate sample
values for the prototype. Verify them (official websites / Google Maps) before the
final demo, and add more places through the Admin > Travel Assets page.
"""
import sys

from app import create_app
from models import TravelAsset, TravelProfile, User, db

# (name, category, tags, lat, lon, cost RM/person, visit min, open, close, rating, description)
ATTRACTIONS = {
    "Kuala Lumpur": [
        ("Petronas Twin Towers Skybridge", "culture", "iconic,view,city", 3.1579, 101.7116, 80, 90, "09:00", "21:00", 4.6, "Walk the skybridge and observation deck of Malaysia's most famous towers."),
        ("KLCC Park", "nature", "park,family,garden", 3.1553, 101.7141, 0, 60, "07:00", "22:00", 4.6, "Green park below the Twin Towers with a fountain show at night."),
        ("Batu Caves", "culture", "temple,history,climb,iconic", 3.2379, 101.6840, 0, 120, "07:00", "21:00", 4.5, "Hindu temple in limestone caves, reached by 272 colourful steps."),
        ("Islamic Arts Museum Malaysia", "culture", "museum,art,history", 3.1418, 101.6896, 20, 120, "09:30", "18:00", 4.7, "Large collection of Islamic art, architecture models and textiles."),
        ("KL Bird Park", "family", "nature,wildlife,park", 3.1432, 101.6884, 85, 150, "09:00", "18:00", 4.4, "Walk-in aviary with thousands of free-flying tropical birds."),
        ("Central Market (Pasar Seni)", "shopping", "culture,souvenir,art,market", 3.1456, 101.6954, 0, 60, "10:00", "21:30", 4.3, "Art-deco market hall full of Malaysian crafts and batik."),
        ("Petaling Street", "food", "shopping,street food,market,culture", 3.1435, 101.6977, 0, 90, "10:00", "23:00", 4.0, "Chinatown street market with hawker food and bargains."),
        ("Jalan Alor Food Street", "food", "street food,hawker,night market", 3.1456, 101.7085, 30, 90, "17:00", "23:30", 4.3, "KL's best-known night food street."),
        ("Merdeka Square", "history", "colonial,culture,iconic", 3.1488, 101.6935, 0, 45, "07:00", "22:00", 4.5, "Where Malaysia's independence was declared in 1957."),
        ("Thean Hou Temple", "culture", "temple,view", 3.1215, 101.6866, 0, 60, "08:00", "22:00", 4.6, "Six-tiered Chinese temple on a hill with city views."),
        ("Aquaria KLCC", "family", "aquarium,wildlife", 3.1536, 101.7135, 75, 120, "10:00", "20:00", 4.4, "Oceanarium with an underwater tunnel and sharks."),
        ("KL Forest Eco Park", "nature", "hike,forest,adventure", 3.1521, 101.7032, 0, 90, "07:00", "18:00", 4.3, "Rainforest in the city with a canopy walk."),
        ("Pavilion Kuala Lumpur", "shopping", "mall,food", 3.1490, 101.7134, 0, 120, "10:00", "22:00", 4.6, "Large mall in Bukit Bintang."),
        ("National Museum (Muzium Negara)", "history", "museum,culture", 3.1375, 101.6874, 5, 90, "09:00", "17:00", 4.3, "Malaysian history from prehistory to independence."),
        ("KL Tower", "adventure", "view,iconic,family", 3.1528, 101.7038, 60, 90, "09:00", "22:00", 4.5, "Telecom tower with a glass Sky Box."),
    ],
    "Penang": [
        ("Penang Hill", "nature", "view,hill,funicular,adventure", 5.4080, 100.2770, 30, 180, "06:30", "23:00", 4.5, "Funicular ride up to cooler air and island views."),
        ("Kek Lok Si Temple", "culture", "temple,history,view", 5.3990, 100.2737, 0, 120, "08:30", "17:30", 4.6, "One of the largest Buddhist temples in Southeast Asia."),
        ("George Town Street Art", "culture", "art,heritage,unesco,history", 5.4146, 100.3366, 0, 120, "08:00", "22:00", 4.5, "Famous murals around Armenian Street in the UNESCO zone."),
        ("Cheong Fatt Tze (Blue Mansion)", "history", "heritage,culture", 5.4214, 100.3347, 25, 60, "09:00", "17:00", 4.5, "Restored 19th-century indigo mansion with guided tours."),
        ("Penang National Park", "nature", "beach,hike,forest,wildlife", 5.4610, 100.2010, 0, 240, "08:00", "17:00", 4.4, "Jungle trails to quiet beaches and a meromictic lake."),
        ("Batu Ferringhi Beach", "beach", "nature,night market,sunset", 5.4728, 100.2484, 0, 150, "08:00", "22:00", 4.1, "Popular beach strip with water sports and a night market."),
        ("Gurney Drive Hawker Centre", "food", "hawker,street food,night market", 5.4378, 100.3093, 30, 90, "17:00", "23:30", 4.2, "Char kway teow, laksa and more by the sea."),
        ("Chew Jetty (Clan Jetties)", "history", "heritage,culture", 5.4127, 100.3405, 0, 45, "08:00", "21:00", 4.2, "Wooden stilt village of Chinese clans."),
        ("Entopia", "family", "nature,butterfly,wildlife", 5.4471, 100.2147, 70, 150, "09:00", "18:00", 4.5, "Butterfly farm and insect discovery centre."),
        ("Fort Cornwallis", "history", "colonial,fort", 5.4205, 100.3439, 20, 60, "09:00", "22:00", 4.0, "Star fort built by the British East India Company."),
        ("Pinang Peranakan Mansion", "history", "heritage,museum,culture", 5.4182, 100.3407, 25, 60, "09:30", "17:00", 4.6, "Opulent Peranakan home and museum."),
        ("The TOP Komtar", "adventure", "view,skywalk,family", 5.4146, 100.3295, 70, 120, "10:00", "22:00", 4.4, "Glass rainbow skywalk 249 m above George Town."),
        ("Chulia Street Night Hawkers", "food", "street food,hawker", 5.4180, 100.3365, 20, 60, "18:00", "23:30", 4.3, "Wonton mee and satay stalls in the old town."),
    ],
    "Melaka": [
        ("A Famosa", "history", "colonial,fort,unesco", 2.1918, 102.2502, 0, 30, "08:00", "21:00", 4.2, "Gate ruin of the 16th-century Portuguese fortress."),
        ("St. Paul's Hill", "history", "church,colonial,view", 2.1928, 102.2494, 0, 45, "08:00", "21:00", 4.4, "Hilltop church ruin with views of the Straits."),
        ("Christ Church & Dutch Square", "history", "culture,church,colonial,iconic", 2.1943, 102.2491, 0, 45, "09:00", "17:00", 4.5, "The famous red Dutch-era square."),
        ("Jonker Street", "shopping", "food,night market,culture,street food", 2.1956, 102.2468, 0, 120, "10:00", "23:00", 4.4, "Antiques by day, food night market on weekends."),
        ("Melaka River Cruise", "culture", "river,family,view", 2.1981, 102.2480, 30, 45, "09:00", "23:00", 4.5, "Boat ride past murals and kampung houses."),
        ("Baba & Nyonya Heritage Museum", "history", "museum,heritage,culture", 2.1966, 102.2456, 18, 60, "10:00", "17:00", 4.5, "Peranakan townhouse museum."),
        ("Melaka Sultanate Palace Museum", "history", "palace,museum,culture", 2.1915, 102.2510, 10, 60, "09:00", "17:30", 4.2, "Wooden replica of the sultan's palace."),
        ("Menara Taming Sari", "adventure", "view,family", 2.1910, 102.2470, 30, 30, "10:00", "22:00", 4.1, "Rotating tower with 360 degree views."),
        ("Cheng Hoon Teng Temple", "culture", "temple,history", 2.1969, 102.2465, 0, 30, "07:00", "19:00", 4.5, "Oldest functioning Chinese temple in Malaysia."),
        ("Zoo Melaka", "family", "wildlife,nature", 2.2770, 102.2985, 30, 150, "09:00", "18:00", 4.0, "Second-largest zoo in Malaysia."),
        ("Klebang Coconut Shake", "food", "beach,dessert,cafe", 2.2140, 102.1960, 10, 60, "10:00", "20:00", 4.2, "Famous coconut shake near Klebang beach."),
        ("Melaka Straits Mosque", "culture", "mosque,sunset,view", 2.1806, 102.2395, 0, 45, "09:00", "19:00", 4.6, "'Floating' mosque on Pulau Melaka at sunset."),
    ],
    "Langkawi": [
        ("SkyCab & Sky Bridge", "adventure", "view,cable car,nature,iconic", 6.3864, 99.6620, 85, 180, "09:30", "19:00", 4.5, "Steep cable car and curved bridge over the rainforest."),
        ("Pantai Cenang", "beach", "sunset,nature,food", 6.2920, 99.7280, 0, 150, "07:00", "22:00", 4.4, "Main beach with cafes and sunset views."),
        ("Kilim Geoforest Park Mangrove Tour", "nature", "kayak,wildlife,adventure,river", 6.4080, 99.8560, 150, 240, "09:00", "17:00", 4.5, "Boat tour through mangroves, eagle feeding and bat cave."),
        ("Seven Wells Waterfall", "nature", "waterfall,hike", 6.3820, 99.6640, 0, 90, "08:00", "18:00", 4.3, "Seven natural pools linked by a waterfall."),
        ("Underwater World Langkawi", "family", "aquarium,wildlife", 6.2880, 99.7290, 45, 90, "09:30", "18:00", 3.9, "Aquarium with penguins and a tunnel."),
        ("Eagle Square (Dataran Lang)", "culture", "iconic,view", 6.3150, 99.8520, 0, 30, "08:00", "22:00", 4.3, "Giant eagle statue at Kuah jetty."),
        ("Kuah Duty-Free Shopping", "shopping", "souvenir,mall", 6.3240, 99.8430, 0, 90, "10:00", "22:00", 4.0, "Duty-free chocolates and souvenirs."),
        ("Tanjung Rhu Beach", "beach", "nature,sunset", 6.4580, 99.8230, 0, 120, "08:00", "19:00", 4.5, "Quiet white-sand beach with limestone islets."),
        ("Island Hopping Tour", "beach", "island,snorkel,adventure,wildlife", 6.2900, 99.7300, 45, 240, "09:00", "17:00", 4.3, "Lake of the Pregnant Maiden, eagle feeding and Beras Basah beach."),
        ("Mahsuri's Tomb", "history", "legend,culture", 6.3260, 99.7820, 15, 60, "08:00", "18:00", 3.9, "Site of Langkawi's famous legend."),
        ("Laman Padi Rice Museum", "culture", "tradition,nature", 6.2950, 99.7300, 0, 45, "09:00", "18:00", 3.8, "Paddy fields and rice-farming heritage."),
        ("Temurun Waterfall", "nature", "waterfall,hike", 6.4190, 99.6870, 0, 60, "08:00", "18:00", 4.2, "Three-tier waterfall in Datai forest."),
    ],
    "Kota Kinabalu": [
        ("Kinabalu Park", "nature", "mountain,hike,unesco,garden", 6.0059, 116.5427, 50, 240, "07:00", "18:00", 4.6, "UNESCO park at the foot of Mount Kinabalu."),
        ("Tunku Abdul Rahman Marine Park", "beach", "island,snorkel,adventure", 5.9840, 116.0170, 60, 300, "08:00", "16:30", 4.4, "Island day trip to Sapi and Manukan."),
        ("Mari Mari Cultural Village", "culture", "tradition,history", 6.0590, 116.2240, 200, 240, "09:00", "17:00", 4.7, "Live demonstrations of five Sabah ethnic groups."),
        ("Signal Hill Observatory", "nature", "view,sunset", 5.9800, 116.0750, 0, 45, "07:00", "22:00", 4.3, "Lookout point over the city and islands."),
        ("KK Handicraft Market", "shopping", "souvenir,market,culture", 5.9849, 116.0739, 0, 60, "09:00", "21:00", 4.0, "Pearls, crafts and dried seafood."),
        ("KK Night Market Seafood", "food", "seafood,night market,street food", 5.9835, 116.0735, 40, 90, "17:00", "23:00", 4.2, "Grilled seafood by the waterfront."),
        ("Kota Kinabalu City Mosque", "culture", "mosque,sunset,iconic", 6.0060, 116.1090, 0, 45, "08:00", "18:00", 4.6, "The 'floating mosque' on a lagoon."),
        ("Tanjung Aru Beach", "beach", "sunset,food", 5.9470, 116.0450, 0, 120, "07:00", "22:00", 4.3, "Best sunset beach in KK."),
        ("Sabah Museum", "history", "museum,culture", 5.9590, 116.0700, 15, 90, "09:00", "17:00", 4.2, "Sabah's history and a heritage village."),
        ("Lok Kawi Wildlife Park", "family", "wildlife,nature", 5.8690, 116.0730, 50, 150, "09:30", "17:00", 4.1, "Orangutans, pygmy elephants and a botanical garden."),
        ("Imago Shopping Mall", "shopping", "mall,food", 5.9700, 116.0670, 0, 90, "10:00", "22:00", 4.4, "Largest mall in Sabah."),
    ],
}

# (name, lat, lon, RM per room per night, rating)
HOTELS = {
    "Kuala Lumpur": [("Bukit Bintang Budget Inn", 3.1460, 101.7100, 90, 3.8),
                     ("KL Sentral Mid-range Hotel", 3.1340, 101.6860, 220, 4.2),
                     ("KLCC Luxury Hotel", 3.1560, 101.7150, 650, 4.7)],
    "Penang": [("George Town Heritage Guesthouse", 5.4170, 100.3370, 100, 4.1),
               ("Gurney Mid-range Hotel", 5.4370, 100.3110, 260, 4.3),
               ("Batu Ferringhi Beach Resort", 5.4740, 100.2440, 550, 4.6)],
    "Melaka": [("Jonker Budget Hostel", 2.1960, 102.2460, 80, 3.9),
               ("Melaka Riverside Hotel", 2.2000, 102.2490, 200, 4.3),
               ("Melaka Heritage Luxury Hotel", 2.1900, 102.2530, 480, 4.6)],
    "Langkawi": [("Cenang Budget Chalet", 6.2930, 99.7270, 110, 3.9),
                 ("Kuah Town Hotel", 6.3220, 99.8420, 210, 4.1),
                 ("Datai Bay Luxury Resort", 6.4230, 99.6850, 1200, 4.8)],
    "Kota Kinabalu": [("KK Waterfront Budget Hotel", 5.9830, 116.0740, 95, 3.9),
                      ("KK City Mid-range Hotel", 5.9780, 116.0760, 230, 4.3),
                      ("Tanjung Aru Beach Resort", 5.9490, 116.0440, 600, 4.6)],
}


def seed(reset=False):
    app = create_app()
    with app.app_context():
        if reset:
            db.drop_all()
        db.create_all()
        if TravelAsset.query.first():
            print("Database already has data. Use: python seed.py --reset to start fresh.")
            return

        for region, rows in ATTRACTIONS.items():
            for (name, cat, tags, lat, lon, cost, mins, op, cl, rating, desc) in rows:
                db.session.add(TravelAsset(name=name, asset_type="attraction", category=cat, tags=tags,
                                           region=region, latitude=lat, longitude=lon, est_cost=cost,
                                           visit_minutes=mins, open_time=op, close_time=cl,
                                           rating=rating, description=desc))
        for region, rows in HOTELS.items():
            for (name, lat, lon, cost, rating) in rows:
                db.session.add(TravelAsset(name=name, asset_type="accommodation", category="hotel",
                                           region=region, latitude=lat, longitude=lon, est_cost=cost,
                                           visit_minutes=0, open_time="00:00", close_time="23:59",
                                           rating=rating, description="Sample accommodation (price per room per night)."))

        admin = User(name="PackMY Admin", email="admin@packmy.com", role="admin")
        admin.set_password("admin123")
        demo = User(name="Demo Traveller", email="demo@packmy.com")
        demo.set_password("demo123")
        demo.profile = TravelProfile(home_state="Melaka", travel_style="moderate", pace="normal",
                                     default_budget=1200, interests="culture,food,history")
        db.session.add_all([admin, demo])
        db.session.commit()
        n = TravelAsset.query.count()
        print(f"Done! Added {n} travel assets and 2 accounts:")
        print("  Admin     : admin@packmy.com / admin123")
        print("  Traveller : demo@packmy.com  / demo123")


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
