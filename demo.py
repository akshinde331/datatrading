import kagglehub
import pandas as pd
from datetime import date, timedelta
import os

# Step 1: Download latest version of the dataset
path = kagglehub.dataset_download("debashis74017/nifty-50-minute-data")
print("Path to dataset files:", path)

# Step 2: Locate the 5-minute CSV file
file_path = os.path.join(path, "NIFTY50_5min.csv")

# Step 3: Load the data
df = pd.read_csv(file_path)

# Ensure datetime column exists & convert
df['datetime'] = pd.to_datetime(df['datetime'])

# Step 4: Filter for yesterday
yesterday = date.today() - timedelta(days=1)
df_yesterday = df[df['datetime'].dt.date == yesterday]

# Step 5: Save to new CSV
output_file = "nifty50_5min_yesterday.csv"
df_yesterday.to_csv(output_file, index=False)

print(f"✅ Saved yesterday's 5-minute data to {output_file}")
print(df_yesterday.head())
